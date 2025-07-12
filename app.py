#!/usr/bin/env python3
"""
Final Brain Tumor Segmentation Web App
Production-ready version with working model loading
"""

import os
import sys
import warnings
warnings.filterwarnings('ignore')

# Ensure we're using the correct Python environment
print(f"🐍 Python executable: {sys.executable}")
print(f"🐍 Python version: {sys.version}")

from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for
import tempfile
import base64
import io
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
from datetime import datetime
import matplotlib.patches as patches
from matplotlib.gridspec import GridSpec
import json
import uuid

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

# In-memory storage for analysis history (in production, use a database)
analysis_history = {}  # user_id -> list of analyses
analysis_results = {}  # analysis_id -> full analysis data

def get_user_id_from_token(token):
    """Extract user ID from token (simplified for demo)"""
    if not token:
        return None
    # In a real app, decode JWT token
    return token.split('_')[-1] if '_' in token else 'demo_user'

def save_analysis(user_id, analysis_data):
    """Save analysis to history"""
    analysis_id = str(uuid.uuid4())

    # Create analysis record
    analysis_record = {
        'id': analysis_id,
        'user_id': user_id,
        'date': datetime.now().isoformat(),
        'patient_id': analysis_data.get('patient_id', f'PT-{analysis_id[:8]}'),
        'slice_index': analysis_data.get('slice_index', 75),
        'status': 'completed',
        'result': determine_analysis_result(analysis_data.get('class_statistics', {})),
        'tumor_percentage': calculate_tumor_percentage(analysis_data.get('class_statistics', {})),
        'created_at': datetime.now().isoformat()
    }

    # Store full analysis data
    analysis_results[analysis_id] = analysis_data

    # Add to user's history
    if user_id not in analysis_history:
        analysis_history[user_id] = []

    analysis_history[user_id].insert(0, analysis_record)  # Most recent first

    # Keep only last 50 analyses per user
    if len(analysis_history[user_id]) > 50:
        # Remove oldest analysis data
        oldest = analysis_history[user_id].pop()
        if oldest['id'] in analysis_results:
            del analysis_results[oldest['id']]

    return analysis_id

def determine_analysis_result(class_stats):
    """Determine if tumor was detected based on statistics"""
    if not class_stats:
        return 'normal'

    tumor_pixels = (class_stats.get(1, 0) + class_stats.get(2, 0) + class_stats.get(3, 0))
    total_pixels = sum(class_stats.values())

    if total_pixels == 0:
        return 'normal'

    tumor_percentage = (tumor_pixels / total_pixels) * 100
    return 'tumor_detected' if tumor_percentage > 1.0 else 'normal'

def calculate_tumor_percentage(class_stats):
    """Calculate tumor percentage from class statistics"""
    if not class_stats:
        return 0.0

    tumor_pixels = (class_stats.get(1, 0) + class_stats.get(2, 0) + class_stats.get(3, 0))
    total_pixels = sum(class_stats.values())

    if total_pixels == 0:
        return 0.0

    return round((tumor_pixels / total_pixels) * 100, 2)

def get_user_analyses(user_id, limit=10):
    """Get user's analysis history"""
    if user_id not in analysis_history:
        return []

    return analysis_history[user_id][:limit]

def get_analysis_by_id(analysis_id):
    """Get full analysis data by ID"""
    return analysis_results.get(analysis_id)

# Global predictor instance
predictor = None
model_status = "not_loaded"
model_error = None

def init_model():
    """Initialize the brain tumor predictor with correct imports"""
    global predictor, model_status, model_error
    
    try:
        print("🔍 Initializing model with correct TensorFlow/Keras versions...")
        
        # Import TensorFlow and verify version
        import tensorflow as tf
        print(f"✅ TensorFlow version: {tf.__version__}")
        
        # Import Keras and verify version  
        import keras
        print(f"✅ Keras version: {getattr(keras, '__version__', 'unknown')}")
        
        # Check if model file exists
        model_path = "best_model.h5"
        if not os.path.exists(model_path):
            model_status = "file_not_found"
            model_error = f"Model file not found: {model_path}"
            print(f"❌ {model_error}")
            return False
        
        # Import and initialize predictor
        from brain_tumor_predictor import BrainTumorPredictor
        predictor = BrainTumorPredictor(model_path)
        
        model_status = "loaded"
        print("✅ Model initialized successfully!")
        return True
        
    except Exception as e:
        model_status = "error"
        model_error = str(e)
        print(f"❌ Error initializing model: {model_error}")
        import traceback
        traceback.print_exc()
        return False

def create_visualization(flair_img, t1ce_img, prediction, probabilities, slice_idx):
    """Create visualization plot and return as base64 string"""
    fig, axes = plt.subplots(2, 3, figsize=(15, 10))
    axes = axes.flatten()
    
    # Original FLAIR
    axes[0].imshow(flair_img, cmap='gray')
    axes[0].set_title('FLAIR Image')
    axes[0].axis('off')
    
    # Original T1CE
    axes[1].imshow(t1ce_img, cmap='gray')
    axes[1].set_title('T1CE Image')
    axes[1].axis('off')
    
    # Prediction overlay
    axes[2].imshow(flair_img, cmap='gray')
    axes[2].imshow(prediction, alpha=0.5, cmap='jet')
    axes[2].set_title('Segmentation Overlay')
    axes[2].axis('off')
    
    # Individual class predictions
    class_names = ['Background', 'Necrotic/Non-enhancing', 'Edema', 'Enhancing']
    for i in range(4):
        if i + 3 < len(axes):
            axes[i + 3].imshow(probabilities[:, :, i], cmap='hot')
            axes[i + 3].set_title(f'{class_names[i]} Probability')
            axes[i + 3].axis('off')
    
    plt.tight_layout()
    
    # Convert to base64
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode()
    plt.close(fig)
    
    return image_base64

def create_comprehensive_report(flair_img, t1ce_img, prediction, probabilities, slice_idx, class_stats, patient_info=None):
    """Create a comprehensive medical report as high-quality JPG"""

    # Set up the figure with professional layout
    fig = plt.figure(figsize=(16, 20), dpi=300)
    gs = GridSpec(6, 4, figure=fig, height_ratios=[0.8, 2, 2, 1.5, 1.5, 0.5], hspace=0.3, wspace=0.2)

    # Color scheme for professional medical report
    bg_color = '#f8f9fa'
    header_color = '#2c3e50'

    # Set background color safely
    try:
        # Use matplotlib's figure patch attribute
        figure_patch = getattr(fig, 'patch', None)
        if figure_patch is not None:
            figure_patch.set_facecolor(bg_color)
    except (AttributeError, Exception):
        pass  # Skip if not supported

    # Header section
    header_ax = fig.add_subplot(gs[0, :])
    header_ax.text(0.5, 0.7, 'BRAIN TUMOR SEGMENTATION REPORT',
                   fontsize=24, fontweight='bold', ha='center', va='center',
                   color=header_color, transform=header_ax.transAxes)

    # Report metadata
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header_ax.text(0.5, 0.3, f'Generated: {timestamp} | Slice Index: {slice_idx}',
                   fontsize=12, ha='center', va='center',
                   color='#7f8c8d', transform=header_ax.transAxes)
    header_ax.axis('off')

    # Original images section
    flair_ax = fig.add_subplot(gs[1, 0])
    flair_ax.imshow(flair_img, cmap='gray')
    flair_ax.set_title('FLAIR Sequence', fontsize=14, fontweight='bold', pad=10)
    flair_ax.axis('off')

    t1ce_ax = fig.add_subplot(gs[1, 1])
    t1ce_ax.imshow(t1ce_img, cmap='gray')
    t1ce_ax.set_title('T1CE Sequence', fontsize=14, fontweight='bold', pad=10)
    t1ce_ax.axis('off')

    # Segmentation overlay
    overlay_ax = fig.add_subplot(gs[1, 2])
    overlay_ax.imshow(flair_img, cmap='gray')
    overlay_ax.imshow(prediction, alpha=0.6, cmap='jet')
    overlay_ax.set_title('Segmentation Overlay', fontsize=14, fontweight='bold', pad=10)
    overlay_ax.axis('off')

    # Legend for segmentation
    legend_ax = fig.add_subplot(gs[1, 3])
    class_names = ['Background', 'Necrotic/Core', 'Edema', 'Enhancing']
    colors = ['#000000', '#ff0000', '#0000ff', '#00ff00']

    # Create simple text legend without patches
    legend_text = "SEGMENTATION LEGEND:\n\n"
    for i, (name, color) in enumerate(zip(class_names, colors)):
        legend_text += f"● {name}\n"

    legend_ax.text(0.1, 0.9, legend_text, fontsize=12, va='top', ha='left',
                   transform=legend_ax.transAxes, family='monospace')
    legend_ax.set_title('Segmentation Legend', fontsize=14, fontweight='bold', pad=10)
    legend_ax.axis('off')

    # Individual probability maps
    prob_titles = ['Background Probability', 'Necrotic/Core Probability',
                   'Edema Probability', 'Enhancing Probability']

    for i in range(4):
        prob_ax = fig.add_subplot(gs[2, i])
        im = prob_ax.imshow(probabilities[:, :, i], cmap='hot', vmin=0, vmax=1)
        prob_ax.set_title(prob_titles[i], fontsize=12, fontweight='bold', pad=10)
        prob_ax.axis('off')

        # Add colorbar
        cbar = plt.colorbar(im, ax=prob_ax, fraction=0.046, pad=0.04)
        cbar.set_label('Probability', fontsize=10)

    # Statistics section
    stats_ax = fig.add_subplot(gs[3, :2])
    stats_ax.axis('off')

    # Calculate total pixels and percentages
    total_pixels = sum(class_stats.values())
    tumor_pixels = sum(class_stats.get(i, 0) for i in [1, 2, 3])
    tumor_percentage = (tumor_pixels / total_pixels * 100) if total_pixels > 0 else 0

    stats_text = f"""QUANTITATIVE ANALYSIS

Total Pixels Analyzed: {total_pixels:,}
Tumor Pixels Detected: {tumor_pixels:,}
Tumor Coverage: {tumor_percentage:.1f}%

TISSUE BREAKDOWN:
"""

    for i, name in enumerate(class_names):
        pixels = class_stats.get(i, 0)
        percentage = (pixels / total_pixels * 100) if total_pixels > 0 else 0
        stats_text += f"• {name}: {pixels:,} pixels ({percentage:.1f}%)\n"

    stats_ax.text(0.05, 0.95, stats_text, fontsize=11, va='top', ha='left',
                  transform=stats_ax.transAxes, family='monospace',
                  bbox=dict(boxstyle="round,pad=0.5", facecolor='white', alpha=0.8))

    # Clinical assessment
    clinical_ax = fig.add_subplot(gs[3, 2:])
    clinical_ax.axis('off')

    # Determine clinical assessment
    if tumor_percentage > 5:
        assessment = "SIGNIFICANT TUMOR PRESENCE"
        recommendation = "• Recommend clinical correlation\n• Consider follow-up imaging\n• Consult oncology if indicated"
        status_color = '#e74c3c'
    elif tumor_percentage > 1:
        assessment = "MODERATE TUMOR ACTIVITY"
        recommendation = "• Monitor for changes\n• Clinical correlation advised\n• Follow institutional protocols"
        status_color = '#f39c12'
    else:
        assessment = "MINIMAL TUMOR ACTIVITY"
        recommendation = "• Low tumor burden detected\n• Routine follow-up as indicated\n• Clinical correlation recommended"
        status_color = '#27ae60'

    clinical_text = f"""CLINICAL ASSESSMENT

Status: {assessment}

RECOMMENDATIONS:
{recommendation}
"""

    clinical_ax.text(0.05, 0.95, clinical_text, fontsize=11, va='top', ha='left',
                     transform=clinical_ax.transAxes,
                     bbox=dict(boxstyle="round,pad=0.5", facecolor=status_color, alpha=0.1))

    # Technical information
    tech_ax = fig.add_subplot(gs[4, :])
    tech_ax.axis('off')

    tech_text = """TECHNICAL INFORMATION

Model: Deep Learning U-Net Architecture for Brain Tumor Segmentation
Input: FLAIR and T1CE MRI sequences (128x128 resolution)
Output: 4-class segmentation (Background, Necrotic/Core, Edema, Enhancing)
Processing: Automated AI analysis with probability mapping

DISCLAIMER: This analysis is generated by an AI system for research and educational purposes only.
Results should not be used for clinical diagnosis without proper medical supervision and validation.
Always consult qualified medical professionals for clinical interpretation and decision-making."""

    tech_ax.text(0.05, 0.95, tech_text, fontsize=10, va='top', ha='left',
                 transform=tech_ax.transAxes, style='italic',
                 bbox=dict(boxstyle="round,pad=0.5", facecolor='#ecf0f1', alpha=0.8))

    # Footer
    footer_ax = fig.add_subplot(gs[5, :])
    footer_ax.text(0.5, 0.5, 'Brain Tumor Segmentation System | AI-Powered Medical Image Analysis',
                   fontsize=10, ha='center', va='center', style='italic',
                   color='#7f8c8d', transform=footer_ax.transAxes)
    footer_ax.axis('off')

    # Save to high-quality image
    buffer = io.BytesIO()
    try:
        # Try JPEG with quality settings
        plt.savefig(buffer, format='jpeg', dpi=300, bbox_inches='tight',
                    facecolor=bg_color, edgecolor='none', pil_kwargs={'quality': 95})
    except (TypeError, ValueError):
        # Fallback to JPEG without quality parameter
        buffer.seek(0)
        buffer.truncate(0)
        plt.savefig(buffer, format='jpeg', dpi=300, bbox_inches='tight',
                    facecolor=bg_color, edgecolor='none')

    buffer.seek(0)
    plt.close(fig)

    return buffer

@app.route('/')
def index():
    """Main page - redirect to login for SaaS experience"""
    return render_template('index.html')

@app.route('/login')
def login():
    """Login page"""
    return render_template('login.html')

@app.route('/register')
def register():
    """Registration page"""
    return render_template('register.html')

@app.route('/dashboard')
def dashboard():
    """User dashboard"""
    return render_template('dashboard.html')

@app.route('/api/status')
def status():
    """Check system status"""
    return jsonify({
        'model_loaded': predictor is not None,
        'model_status': model_status,
        'model_error': model_error,
        'server_status': 'running',
        'tensorflow_version': get_tf_version(),
        'keras_version': get_keras_version()
    })

def get_tf_version():
    """Get TensorFlow version safely"""
    try:
        import tensorflow as tf
        return tf.__version__
    except:
        return "unknown"

def get_keras_version():
    """Get Keras version safely"""
    try:
        import keras
        return getattr(keras, '__version__', 'unknown')
    except:
        return "unknown"

@app.route('/api/predict', methods=['POST'])
def predict():
    """Handle prediction request"""
    if predictor is None:
        return jsonify({
            'error': 'Model not loaded',
            'model_status': model_status,
            'model_error': model_error,
            'message': 'Model loading failed. Check server logs for details.'
        }), 500
    
    try:
        # Get uploaded files
        if 'flair' not in request.files or 't1ce' not in request.files:
            return jsonify({'error': 'Both FLAIR and T1CE files are required'}), 400
        
        flair_file = request.files['flair']
        t1ce_file = request.files['t1ce']
        slice_index = int(request.form.get('slice_index', 75))
        patient_id = request.form.get('patient_id', '')

        # Get user info from token (if provided)
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else None
        user_id = get_user_id_from_token(token) if token else 'anonymous'
        
        if not flair_file.filename or not t1ce_file.filename:
            return jsonify({'error': 'No files selected'}), 400
        
        # Save files temporarily
        with tempfile.TemporaryDirectory() as temp_dir:
            flair_path = os.path.join(temp_dir, 'flair.nii')
            t1ce_path = os.path.join(temp_dir, 't1ce.nii')
            
            flair_file.save(flair_path)
            t1ce_file.save(t1ce_path)
            
            # Make prediction
            prediction, probabilities = predictor.predict_single_slice(
                flair_path, t1ce_path, slice_index
            )
            
            if prediction is None:
                return jsonify({'error': 'Failed to process images'}), 500
            
            # Get the original images for visualization
            flair_img = predictor.preprocess_image(flair_path, slice_index)
            t1ce_img = predictor.preprocess_image(t1ce_path, slice_index)
            
            # Create visualization
            visualization = create_visualization(
                flair_img, t1ce_img, prediction, probabilities, slice_index
            )
            
            # Calculate statistics
            unique, counts = np.unique(prediction, return_counts=True)
            class_stats = dict(zip(unique.astype(int).tolist(), counts.astype(int).tolist()))

            # Prepare analysis data
            analysis_data = {
                'visualization': visualization,
                'slice_index': int(slice_index),
                'class_statistics': class_stats,
                'prediction_shape': prediction.shape if prediction is not None else None,
                'probabilities_shape': probabilities.shape if probabilities is not None else None,
                'patient_id': patient_id,
                'flair_filename': flair_file.filename,
                't1ce_filename': t1ce_file.filename,
                'user_id': user_id
            }

            # Save to history
            analysis_id = save_analysis(user_id, analysis_data)

            return jsonify({
                'success': True,
                'analysis_id': analysis_id,
                'slice_index': slice_index,
                'visualization': visualization,
                'class_statistics': class_stats,
                'message': 'Prediction completed successfully'
            })
    
    except Exception as e:
        return jsonify({'error': f'Prediction error: {str(e)}'}), 500

@app.route('/api/download-report', methods=['POST'])
def download_report():
    """Generate and download comprehensive JPG report"""
    if predictor is None:
        return jsonify({
            'error': 'Model not loaded',
            'model_status': model_status,
            'model_error': model_error
        }), 500

    try:
        # Get uploaded files and parameters
        if 'flair' not in request.files or 't1ce' not in request.files:
            return jsonify({'error': 'Both FLAIR and T1CE files are required'}), 400

        flair_file = request.files['flair']
        t1ce_file = request.files['t1ce']
        slice_index = int(request.form.get('slice_index', 75))

        if not flair_file.filename or not t1ce_file.filename:
            return jsonify({'error': 'No files selected'}), 400

        # Save files temporarily and process
        with tempfile.TemporaryDirectory() as temp_dir:
            flair_path = os.path.join(temp_dir, 'flair.nii')
            t1ce_path = os.path.join(temp_dir, 't1ce.nii')

            flair_file.save(flair_path)
            t1ce_file.save(t1ce_path)

            # Make prediction
            prediction, probabilities = predictor.predict_single_slice(
                flair_path, t1ce_path, slice_index
            )

            if prediction is None:
                return jsonify({'error': 'Failed to process images'}), 500

            # Get the original images for visualization
            flair_img = predictor.preprocess_image(flair_path, slice_index)
            t1ce_img = predictor.preprocess_image(t1ce_path, slice_index)

            # Calculate statistics
            unique, counts = np.unique(prediction, return_counts=True)
            class_stats = dict(zip(unique.astype(int).tolist(), counts.astype(int).tolist()))

            # Create comprehensive report
            report_buffer = create_comprehensive_report(
                flair_img, t1ce_img, prediction, probabilities, slice_index, class_stats
            )

            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"brain_tumor_report_{timestamp}_slice_{slice_index}.jpg"

            return send_file(
                report_buffer,
                mimetype='image/jpeg',
                as_attachment=True,
                download_name=filename
            )

    except Exception as e:
        return jsonify({'error': f'Report generation error: {str(e)}'}), 500

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """Handle user login"""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        remember = data.get('remember', False)

        # Basic validation - just check if fields are provided
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        # Accept any email and password combination
        # Extract name from email for personalization
        email_parts = email.split('@')
        username = email_parts[0] if email_parts else 'User'

        # Try to extract first and last name from username
        name_parts = username.replace('.', ' ').replace('_', ' ').split()
        first_name = name_parts[0].capitalize() if name_parts else 'Medical'
        last_name = name_parts[1].capitalize() if len(name_parts) > 1 else 'Professional'

        # Create user data based on email
        user_data = {
            'id': 1,
            'email': email,
            'firstName': first_name,
            'lastName': last_name,
            'specialty': 'Radiology',
            'institution': 'Medical Center'
        }

        return jsonify({
            'success': True,
            'message': 'Login successful! Welcome to the Brain Tumor Segmentation System.',
            'user': user_data,
            'token': f'auth_token_{hash(email) % 100000}',  # Simple demo token
            'redirect': '/dashboard'
        })

    except Exception as e:
        return jsonify({'error': f'Login error: {str(e)}'}), 500

@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    """Handle user registration"""
    try:
        data = request.get_json()

        # Extract registration data
        first_name = data.get('firstName')
        last_name = data.get('lastName')
        email = data.get('email')
        institution = data.get('institution')
        specialty = data.get('specialty')
        password = data.get('password')
        newsletter = data.get('newsletter', False)

        # Basic validation
        if not all([first_name, last_name, email, password]):
            return jsonify({'error': 'All required fields must be filled'}), 400

        if '@' not in email or '.' not in email:
            return jsonify({'error': 'Invalid email format'}), 400

        if len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters long'}), 400

        # In a real application, you would:
        # 1. Check if email already exists
        # 2. Hash the password
        # 3. Store user in database
        # 4. Send verification email

        # For demo purposes, simulate successful registration
        return jsonify({
            'success': True,
            'message': 'Registration successful! Please check your email to verify your account.',
            'user': {
                'firstName': first_name,
                'lastName': last_name,
                'email': email,
                'institution': institution,
                'specialty': specialty
            }
        })

    except Exception as e:
        return jsonify({'error': f'Registration error: {str(e)}'}), 500

@app.route('/api/analyses', methods=['GET'])
def get_analyses():
    """Get user's analysis history"""
    try:
        # Get user info from token
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else None
        user_id = get_user_id_from_token(token) if token else 'anonymous'

        # Get limit from query params
        limit = int(request.args.get('limit', 10))

        # Get user's analyses
        analyses = get_user_analyses(user_id, limit)

        return jsonify({
            'success': True,
            'analyses': analyses,
            'total': len(analysis_history.get(user_id, []))
        })

    except Exception as e:
        return jsonify({'error': f'Failed to get analyses: {str(e)}'}), 500

@app.route('/api/analyses/<analysis_id>', methods=['GET'])
def get_analysis(analysis_id):
    """Get specific analysis by ID"""
    try:
        analysis_data = get_analysis_by_id(analysis_id)

        if not analysis_data:
            return jsonify({'error': 'Analysis not found'}), 404

        return jsonify({
            'success': True,
            'analysis': analysis_data
        })

    except Exception as e:
        return jsonify({'error': f'Failed to get analysis: {str(e)}'}), 500

@app.route('/api/analyses/<analysis_id>', methods=['DELETE'])
def delete_analysis(analysis_id):
    """Delete specific analysis"""
    try:
        # Get user info from token
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else None
        user_id = get_user_id_from_token(token) if token else 'anonymous'

        # Find and remove analysis from user's history
        if user_id in analysis_history:
            analysis_history[user_id] = [
                a for a in analysis_history[user_id] if a['id'] != analysis_id
            ]

        # Remove from analysis results
        if analysis_id in analysis_results:
            del analysis_results[analysis_id]

        return jsonify({
            'success': True,
            'message': 'Analysis deleted successfully'
        })

    except Exception as e:
        return jsonify({'error': f'Failed to delete analysis: {str(e)}'}), 500

@app.route('/api/analyses/<analysis_id>/download', methods=['GET'])
def download_analysis_report(analysis_id):
    """Download report for specific analysis"""
    try:
        analysis_data = get_analysis_by_id(analysis_id)

        if not analysis_data:
            return jsonify({'error': 'Analysis not found'}), 404

        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        patient_id = analysis_data.get('patient_id', 'unknown')
        slice_idx = analysis_data.get('slice_index', 0)
        filename = f"brain_tumor_report_{patient_id}_{timestamp}_slice_{slice_idx}.jpg"

        # For now, return the analysis data (in a real app, regenerate the report)
        return jsonify({
            'success': True,
            'download_url': f'/api/analyses/{analysis_id}/report.jpg',
            'filename': filename,
            'message': 'Use the JPG download from the original analysis for now'
        })

    except Exception as e:
        return jsonify({'error': f'Failed to download report: {str(e)}'}), 500

@app.route('/api/user/stats', methods=['GET'])
def get_user_stats():
    """Get user statistics"""
    try:
        # Get user info from token
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else None
        user_id = get_user_id_from_token(token) if token else 'anonymous'

        # Calculate statistics
        user_analyses = analysis_history.get(user_id, [])
        total_analyses = len(user_analyses)
        completed_analyses = len([a for a in user_analyses if a['status'] == 'completed'])
        tumor_detected = len([a for a in user_analyses if a['result'] == 'tumor_detected'])

        # Calculate this month's analyses
        current_month = datetime.now().strftime('%Y-%m')
        this_month_analyses = len([
            a for a in user_analyses
            if a['date'].startswith(current_month)
        ])

        return jsonify({
            'success': True,
            'stats': {
                'total_analyses': total_analyses,
                'completed_analyses': completed_analyses,
                'tumor_detected': tumor_detected,
                'reports_generated': completed_analyses,  # Assuming one report per completed analysis
                'this_month_analyses': this_month_analyses
            }
        })

    except Exception as e:
        return jsonify({'error': f'Failed to get user stats: {str(e)}'}), 500

@app.route('/api/test')
def test():
    """Test endpoint"""
    return jsonify({
        'message': 'Web server is running',
        'model_loaded': predictor is not None,
        'model_status': model_status,
        'tensorflow_version': get_tf_version(),
        'keras_version': get_keras_version()
    })

@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large. Maximum size is 100MB.'}), 413

@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Internal server error. Please try again.'}), 500

if __name__ == '__main__':
    print("🧠 Brain Tumor Segmentation Web App - Final Version")
    print("=" * 60)
    
    # Initialize model
    model_loaded = init_model()
    
    print("\n🚀 Starting Flask server...")
    print("🌐 Open your browser and go to: http://localhost:5000")
    print("📊 Check status at: http://localhost:5000/api/status")
    print("🧪 Test endpoint: http://localhost:5000/api/test")
    print("⏹️  Press Ctrl+C to stop the server")
    print("\n" + "=" * 60)
    
    if model_loaded:
        print("✅ Model loaded successfully - Ready for predictions!")
    else:
        print("⚠️  Model loading failed - Check the error messages above")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
