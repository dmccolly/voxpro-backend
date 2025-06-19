from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    storage_used = db.Column(db.Integer, default=0)  # bytes
    storage_limit = db.Column(db.Integer, default=1073741824)  # 1GB default
    
    # Relationships
    files = db.relationship('MediaFile', backref='user', lazy=True, cascade='all, delete-orphan')
    assignments = db.relationship('KeyAssignment', backref='user', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'created_at': self.created_at.isoformat(),
            'storage_used': self.storage_used,
            'storage_limit': self.storage_limit,
            'storage_used_mb': round(self.storage_used / 1024 / 1024, 2),
            'storage_limit_mb': round(self.storage_limit / 1024 / 1024, 2),
            'storage_percentage': round((self.storage_used / self.storage_limit) * 100, 1) if self.storage_limit > 0 else 0
        }

class MediaFile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    file_type = db.Column(db.String(20), nullable=False)  # IMAGE, VIDEO, AUDIO, PDF, TEXT, DOCUMENT
    
    # Storage information
    storage_path = db.Column(db.String(500), nullable=False)  # Local path or cloud URL
    thumbnail_path = db.Column(db.String(500))  # Thumbnail URL if applicable
    
    # Metadata
    title = db.Column(db.String(200))
    description = db.Column(db.Text)
    tags = db.Column(db.Text)  # JSON array as string
    duration = db.Column(db.Integer)  # For audio/video in seconds
    width = db.Column(db.Integer)  # For images/video
    height = db.Column(db.Integer)  # For images/video
    
    # Timestamps
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_accessed = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    assignments = db.relationship('KeyAssignment', backref='media_file', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'filename': self.filename,
            'original_name': self.original_name,
            'mime_type': self.mime_type,
            'file_size': self.file_size,
            'file_size_mb': round(self.file_size / 1024 / 1024, 2),
            'file_type': self.file_type,
            'storage_path': self.storage_path,
            'thumbnail_path': self.thumbnail_path,
            'title': self.title,
            'description': self.description,
            'tags': json.loads(self.tags) if self.tags else [],
            'duration': self.duration,
            'width': self.width,
            'height': self.height,
            'uploaded_at': self.uploaded_at.isoformat(),
            'last_accessed': self.last_accessed.isoformat()
        }

class KeyAssignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    file_id = db.Column(db.Integer, db.ForeignKey('media_file.id'), nullable=False)
    key_number = db.Column(db.Integer, nullable=False)  # 1-5
    custom_title = db.Column(db.String(200))
    custom_description = db.Column(db.Text)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Unique constraint: one file per key per user
    __table_args__ = (db.UniqueConstraint('user_id', 'key_number', name='unique_user_key'),)

    def to_dict(self):
        file_data = self.media_file.to_dict() if self.media_file else None
        return {
            'id': self.id,
            'user_id': self.user_id,
            'file_id': self.file_id,
            'key_number': self.key_number,
            'custom_title': self.custom_title,
            'custom_description': self.custom_description,
            'assigned_at': self.assigned_at.isoformat(),
            'file': file_data,
            'display_title': self.custom_title or (file_data['title'] if file_data else 'Untitled'),
            'display_description': self.custom_description or (file_data['description'] if file_data else '')
        }

