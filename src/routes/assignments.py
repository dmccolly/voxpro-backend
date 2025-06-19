from flask import Blueprint, jsonify, request
from src.models.user import User, MediaFile, KeyAssignment, db
from datetime import datetime

assignments_bp = Blueprint('assignments', __name__)

@assignments_bp.route('/assign', methods=['POST'])
def assign_file_to_key():
    """Assign a file to a specific key"""
    try:
        data = request.get_json()
        
        user_id = data.get('user_id', 1)
        file_id = data.get('file_id')
        key_number = data.get('key_number')
        custom_title = data.get('custom_title', '')
        custom_description = data.get('custom_description', '')
        
        if not all([file_id, key_number]):
            return jsonify({'error': 'Missing file_id or key_number'}), 400
        
        if key_number not in range(1, 6):
            return jsonify({'error': 'Key number must be between 1 and 5'}), 400
        
        # Check if file exists
        media_file = MediaFile.query.get(file_id)
        if not media_file:
            return jsonify({'error': 'File not found'}), 404
        
        if media_file.user_id != user_id:
            return jsonify({'error': 'Unauthorized access to file'}), 403
        
        # Check if key already has an assignment
        existing_assignment = KeyAssignment.query.filter_by(
            user_id=user_id, 
            key_number=key_number
        ).first()
        
        if existing_assignment:
            # Update existing assignment
            existing_assignment.file_id = file_id
            existing_assignment.custom_title = custom_title
            existing_assignment.custom_description = custom_description
            existing_assignment.assigned_at = datetime.utcnow()
            
            db.session.commit()
            
            return jsonify({
                'message': f'Key {key_number} assignment updated successfully',
                'assignment': existing_assignment.to_dict()
            })
        else:
            # Create new assignment
            assignment = KeyAssignment(
                user_id=user_id,
                file_id=file_id,
                key_number=key_number,
                custom_title=custom_title,
                custom_description=custom_description
            )
            
            db.session.add(assignment)
            db.session.commit()
            
            return jsonify({
                'message': f'File assigned to Key {key_number} successfully',
                'assignment': assignment.to_dict()
            }), 201
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Assignment failed: {str(e)}'}), 500

@assignments_bp.route('/assignments', methods=['GET'])
def get_assignments():
    """Get all key assignments for a user"""
    try:
        user_id = request.args.get('user_id', 1, type=int)
        
        assignments = KeyAssignment.query.filter_by(user_id=user_id).order_by(KeyAssignment.key_number).all()
        
        # Create a complete assignment map (1-5)
        assignment_map = {}
        for i in range(1, 6):
            assignment_map[i] = None
        
        for assignment in assignments:
            assignment_map[assignment.key_number] = assignment.to_dict()
        
        return jsonify({
            'assignments': assignment_map,
            'count': len(assignments)
        })
        
    except Exception as e:
        return jsonify({'error': f'Get assignments failed: {str(e)}'}), 500

@assignments_bp.route('/assignments/<int:key_number>', methods=['GET'])
def get_key_assignment(key_number):
    """Get assignment for a specific key"""
    try:
        if key_number not in range(1, 6):
            return jsonify({'error': 'Key number must be between 1 and 5'}), 400
        
        user_id = request.args.get('user_id', 1, type=int)
        
        assignment = KeyAssignment.query.filter_by(
            user_id=user_id, 
            key_number=key_number
        ).first()
        
        if assignment:
            return jsonify(assignment.to_dict())
        else:
            return jsonify({
                'key_number': key_number,
                'assigned': False,
                'message': f'No file assigned to Key {key_number}'
            })
            
    except Exception as e:
        return jsonify({'error': f'Get key assignment failed: {str(e)}'}), 500

@assignments_bp.route('/assignments/<int:key_number>', methods=['DELETE'])
def unassign_key(key_number):
    """Remove assignment from a specific key"""
    try:
        if key_number not in range(1, 6):
            return jsonify({'error': 'Key number must be between 1 and 5'}), 400
        
        user_id = request.args.get('user_id', 1, type=int)
        
        assignment = KeyAssignment.query.filter_by(
            user_id=user_id, 
            key_number=key_number
        ).first()
        
        if assignment:
            db.session.delete(assignment)
            db.session.commit()
            
            return jsonify({
                'message': f'Key {key_number} unassigned successfully'
            })
        else:
            return jsonify({
                'message': f'Key {key_number} was not assigned'
            }), 404
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Unassign failed: {str(e)}'}), 500

@assignments_bp.route('/assignments/<int:key_number>', methods=['PUT'])
def update_assignment(key_number):
    """Update assignment metadata for a specific key"""
    try:
        if key_number not in range(1, 6):
            return jsonify({'error': 'Key number must be between 1 and 5'}), 400
        
        user_id = request.args.get('user_id', 1, type=int)
        data = request.get_json()
        
        assignment = KeyAssignment.query.filter_by(
            user_id=user_id, 
            key_number=key_number
        ).first()
        
        if not assignment:
            return jsonify({'error': f'No assignment found for Key {key_number}'}), 404
        
        # Update assignment metadata
        if 'custom_title' in data:
            assignment.custom_title = data['custom_title']
        if 'custom_description' in data:
            assignment.custom_description = data['custom_description']
        
        db.session.commit()
        
        return jsonify({
            'message': f'Key {key_number} assignment updated successfully',
            'assignment': assignment.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Update assignment failed: {str(e)}'}), 500

@assignments_bp.route('/clear', methods=['POST'])
def clear_all_assignments():
    """Clear all key assignments for a user"""
    try:
        user_id = request.args.get('user_id', 1, type=int)
        
        assignments = KeyAssignment.query.filter_by(user_id=user_id).all()
        
        for assignment in assignments:
            db.session.delete(assignment)
        
        db.session.commit()
        
        return jsonify({
            'message': f'All assignments cleared for user {user_id}',
            'cleared_count': len(assignments)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Clear assignments failed: {str(e)}'}), 500

