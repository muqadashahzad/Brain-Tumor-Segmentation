# 🧠 Brain Tumor Segmentation Web Application

A production-ready web application for brain tumor segmentation using deep learning. This application provides an intuitive web interface for uploading MRI images and getting real-time brain tumor segmentation results.

## 🎯 Features

- **🌐 Web-based Interface**: Easy-to-use web interface for uploading and analyzing MRI images
- **⚡ Real-time Predictions**: Fast brain tumor segmentation using a trained deep learning model
- **🧠 Multi-class Segmentation**: Identifies different tumor regions (necrotic, edema, enhancing)
- **📊 Visualization**: Interactive visualization of segmentation results with probability maps
- **🚀 Production Ready**: Optimized for deployment with proper error handling and logging

## 📋 Requirements

- Python 3.13+
- TensorFlow 2.20.0-dev (included in setup)
- Keras 3.10.0-dev (included in setup)
- Flask, OpenCV, NumPy, Matplotlib
- NiBabel (for NIfTI file handling)

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)
1. Run the setup script:
   ```cmd
   setup.bat
   ```

2. Start the application:
   ```cmd
   start_app.bat
   ```

### Option 2: Manual Setup
1. Create a virtual environment:
   ```cmd
   python -m venv .venv
   .\.venv\Scripts\activate
   ```

2. Install dependencies:
   ```cmd
   pip install -r requirements.txt
   ```

3. Start the application:
   ```cmd
   .\.venv\Scripts\python.exe app.py
   ```

## 🌐 Usage

1. Open your browser and navigate to `http://localhost:5000`
2. Upload your MRI images (FLAIR and T1CE in NIfTI format)
3. Select the slice index to analyze
4. Click "Predict" to get segmentation results
5. View the visualization and class statistics

## 🧠 Model Information

The application uses a trained U-Net model for brain tumor segmentation that identifies:
- **Background** (Class 0) - Normal brain tissue
- **Necrotic/Non-enhancing** (Class 1) - Dead tumor tissue
- **Edema** (Class 2) - Swelling around tumor
- **Enhancing** (Class 3) - Active tumor tissue

**Model Specifications:**
- Input: (128, 128, 2) - FLAIR and T1CE images
- Output: (128, 128, 4) - 4-class probability maps
- Architecture: U-Net with skip connections

## 📁 File Structure

```
Brain Tool/
├── app.py                    # Main Flask application
├── brain_tumor_predictor.py  # Model prediction class
├── best_model.h5            # Trained model weights
├── requirements.txt         # Python dependencies
├── start_app.bat           # Quick start script
├── setup.bat               # Setup script
├── templates/
│   └── index.html          # Web interface template
├── static/
│   ├── style.css           # Styling
│   └── script.js           # Frontend JavaScript
├── .venv/                  # Virtual environment
└── README.md               # This file
```

## 🔌 API Endpoints

- `GET /` - Main web interface
- `POST /api/predict` - Upload images and get predictions
- `GET /api/status` - Check application and model status
- `GET /api/test` - Test endpoint

## 🛠️ Technical Details

- **Framework**: Flask web framework
- **Model**: TensorFlow/Keras U-Net architecture
- **Image Processing**: OpenCV and NiBabel
- **Frontend**: HTML5, CSS3, JavaScript
- **Visualization**: Matplotlib with base64 encoding

## 🔧 Troubleshooting

If you encounter issues:

1. **Model loading errors**: Ensure you're using the correct Python environment
2. **Import errors**: Run `setup.bat` to install all dependencies
3. **Port conflicts**: The app runs on port 5000 by default
4. **File upload issues**: Ensure files are in NIfTI (.nii) format

## 📊 Performance

- **Prediction Time**: ~2-5 seconds per slice
- **Memory Usage**: ~2GB RAM recommended
- **File Size Limit**: 100MB per upload
- **Supported Formats**: NIfTI (.nii, .nii.gz)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## ⚠️ Medical Disclaimer

**IMPORTANT**: This tool is for research and educational purposes only. It should NOT be used for clinical diagnosis or treatment decisions without proper medical supervision. Always consult qualified medical professionals for patient care.

---

**Happy analyzing! 🧠✨**
