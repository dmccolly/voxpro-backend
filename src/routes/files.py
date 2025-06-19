from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename
from src.models.user import User, MediaFile, KeyAssignment, db
import os
import uuid
import mimetypes
from datetime import datetime
import json
from PIL import Image
import io
import base64

files_bp = Blueprint('files', __name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {
    'image': {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff'},
    'video': {'mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv', 'flv', 'mkv'},
    'audio': {'mp3', 'wav', 'aac', 'flac', 'm4a', 'wma', 'ogg'},
    'document': {'pdf', 'txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'csv'}
}

def allowed_file(filename):
    """Check if file extension is allowed"""
    if '.' not in filename:
        return False, None
    
    extension = filename.rsplit('.', 1)[1].lower()
    
    for file_type, extensions in ALLOWED_EXTENSIONS.items():
        if extension in extensions:
            return True, file_type.upper()
    
    return False, None

def get_file_type_from_mime(mime_type):
    """Determine file type from MIME type"""
    if mime_type.startswith('image/'):
        return 'IMAGE'
    elif mime_type.startswith('video/'):
        return 'VIDEO'
    elif mime_type.startswith('audio/'):
        return 'AUDIO'
    elif mime_type == 'application/pdf':
        return 'PDF'
    elif mime_type.startswith('text/'):
        return 'TEXT'
    else:
        return 'DOCUMENT'

def create_thumbnail(file_data, mime_type):
    """Create thumbnail for images"""
    if not mime_type.startswith('image/'):
        return None
    
    try:
        # Convert base64 to image
        if file_data.startswith('data:'):
            header, data = file_data.split(',', 1)
            image_data = base64.b64decode(data)
        else:
            image_data = base64.b64decode(file_data)
        
        image = Image.open(io.BytesIO(image_data))
        
        # Create thumbnail
        thumbnail_size = (200, 200)
        image.thumbnail(thumbnail_size, Image.Resampling.LANCZOS)
        
        # Convert back to base64
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=85)
        thumbnail_data = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/jpeg;base64,{thumbnail_data}"
    except Exception as e:
        print(f"Error creating thumbnail: {e}")
        return None

def ensure_upload_directory():
    """Ensure upload directory exists"""
    upload_path = os.path.join(current_app.root_path, UPLOAD_FOLDER)
    if not os.path.exists(upload_path):
        os.makedirs(upload_path)
    return upload_path

@files_bp.route('/upload', methods=['POST'])
def upload_file():
    """Upload a file and store metadata"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Extract file information
        file_data = data.get('file_data')
        filename = data.get('filename')
        mime_type = data.get('mime_type')
        file_size = data.get('file_size', 0)
        title = data.get('title', '')
        description = data.get('description', '')
        user_id = data.get('user_id', 1)  # Default user for now
        
        if not all([file_data, filename, mime_type]):
            return jsonify({'error': 'Missing required file information'}), 400
        
        # Validate file type
        is_allowed, file_type = allowed_file(filename)
        if not is_allowed:
            return jsonify({'error': f'File type not allowed: {filename}'}), 400
        
        # If file type couldn't be determined from extension, use MIME type
        if not file_type:
            file_type = get_file_type_from_mime(mime_type)
        
        # Check user storage limit
        user = User.query.get(user_id)
        if not user:
            # Create default user if doesn't exist
            user = User(email='default@voxpro.com', name='Default User')
            db.session.add(user)
            db.session.commit()
        
        if user.storage_used + file_size > user.storage_limit:
            return jsonify({
                'error': 'Storage limit exceeded',
                'storage_used': user.storage_used,
                'storage_limit': user.storage_limit,
                'file_size': file_size
            }), 413
        
        # Generate unique filename
        file_extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
        
        # Ensure upload directory exists
        upload_path = ensure_upload_directory()
        file_path = os.path.join(upload_path, unique_filename)
        
        # Save file data (base64 to file)
        try:
            if file_data.startswith('data:'):
                # Remove data URL prefix
                header, data = file_data.split(',', 1)
                file_bytes = base64.b64decode(data)
            else:
                file_bytes = base64.b64decode(file_data)
            
            with open(file_path, 'wb') as f:
                f.write(file_bytes)
                
        except Exception as e:
            return jsonify({'error': f'Failed to save file: {str(e)}'}), 500
        
        # Create thumbnail if it's an image
        thumbnail_path = None
        width = None
        height = None
        
        if file_type == 'IMAGE':
            thumbnail_data = create_thumbnail(file_data, mime_type)
            if thumbnail_data:
                thumbnail_filename = f"thumb_{unique_filename}.jpg"
                thumbnail_full_path = os.path.join(upload_path, thumbnail_filename)
                
                # Save thumbnail
                try:
                    header, thumb_data = thumbnail_data.split(',', 1)
                    thumb_bytes = base64.b64decode(thumb_data)
                    with open(thumbnail_full_path, 'wb') as f:
                        f.write(thumb_bytes)
                    thumbnail_path = f"/api/files/thumbnail/{thumbnail_filename}"
                except Exception as e:
                    print(f"Failed to save thumbnail: {e}")
            
            # Get image dimensions
            try:
                with Image.open(file_path) as img:
                    width, height = img.size
            except Exception as e:
                print(f"Failed to get image dimensions: {e}")
        
        # Create database record
        media_file = MediaFile(
            user_id=user_id,
            filename=unique_filename,
            original_name=filename,
            mime_type=mime_type,
            file_size=file_size,
            file_type=file_type,
            storage_path=f"/api/files/download/{unique_filename}",
            thumbnail_path=thumbnail_path,
            title=title or filename,
            description=description,
            width=width,
            height=height
        )
        
        db.session.add(media_file)
        
        # Update user storage
        user.storage_used += file_size
        
        db.session.commit()
        
        return jsonify({
            'message': 'File uploaded successfully',
            'file': media_file.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

@files_bp.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    """Download a file"""
    try:
        upload_path = ensure_upload_directory()
        file_path = os.path.join(upload_path, filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        # Update last accessed time
        media_file = MediaFile.query.filter_by(filename=filename).first()
        if media_file:
            media_file.last_accessed = datetime.utcnow()
            db.session.commit()
        
        # Read file and return as base64
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        # Get MIME type
        mime_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
        
        # Convert to base64
        file_base64 = base64.b64encode(file_data).decode()
        data_url = f"data:{mime_type};base64,{file_base64}"
        
        return jsonify({
            'filename': filename,
            'mime_type': mime_type,
            'data': data_url,
            'size': len(file_data)
        })
        
    except Exception as e:
        return jsonify({'error': f'Download failed: {str(e)}'}), 500

@files_bp.route('/thumbnail/<filename>', methods=['GET'])
def get_thumbnail(filename):
    """Get thumbnail for a file"""
    try:
        upload_path = ensure_upload_directory()
        file_path = os.path.join(upload_path, filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'Thumbnail not found'}), 404
        
        # Read thumbnail and return as base64
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        file_base64 = base64.b64encode(file_data).decode()
        data_url = f"data:image/jpeg;base64,{file_base64}"
        
        return jsonify({
            'thumbnail': data_url
        })
        
    except Exception as e:
        return jsonify({'error': f'Thumbnail failed: {str(e)}'}), 500

@files_bp.route('/list', methods=['GET'])
def list_files():
    """List all files for a user"""
    try:
        user_id = request.args.get('user_id', 1, type=int)
        
        files = MediaFile.query.filter_by(user_id=user_id).order_by(MediaFile.uploaded_at.desc()).all()
        
        return jsonify({
            'files': [file.to_dict() for file in files],
            'count': len(files)
        })
        
    except Exception as e:
        return jsonify({'error': f'List failed: {str(e)}'}), 500

@files_bp.route('/<int:file_id>', methods=['GET'])
def get_file(file_id):
    """Get specific file information"""
    try:
        media_file = MediaFile.query.get_or_404(file_id)
        return jsonify(media_file.to_dict())
        
    except Exception as e:
        return jsonify({'error': f'Get file failed: {str(e)}'}), 500

@files_bp.route('/<int:file_id>', methods=['PUT'])
def update_file(file_id):
    """Update file metadata"""
    try:
        media_file = MediaFile.query.get_or_404(file_id)
        data = request.get_json()
        
        if 'title' in data:
            media_file.title = data['title']
        if 'description' in data:
            media_file.description = data['description']
        if 'tags' in data:
            media_file.tags = json.dumps(data['tags'])
        
        db.session.commit()
        
        return jsonify({
            'message': 'File updated successfully',
            'file': media_file.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Update failed: {str(e)}'}), 500

@files_bp.route('/<int:file_id>', methods=['DELETE'])
def delete_file(file_id):
    """Delete a file"""
    try:
        media_file = MediaFile.query.get_or_404(file_id)
        
        # Delete physical file
        upload_path = ensure_upload_directory()
        file_path = os.path.join(upload_path, media_file.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # Delete thumbnail if exists
        if media_file.thumbnail_path:
            thumbnail_filename = media_file.thumbnail_path.split('/')[-1]
            thumbnail_path = os.path.join(upload_path, thumbnail_filename)
            if os.path.exists(thumbnail_path):
                os.remove(thumbnail_path)
        
        # Update user storage
        user = User.query.get(media_file.user_id)
        if user:
            user.storage_used -= media_file.file_size
        
        # Delete database record
        db.session.delete(media_file)
        db.session.commit()
        
        return jsonify({'message': 'File deleted successfully'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Delete failed: {str(e)}'}), 500

