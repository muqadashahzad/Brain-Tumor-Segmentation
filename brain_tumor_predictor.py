#!/usr/bin/env python3
"""
Brain Tumor Segmentation Predictor
Uses the trained model to predict brain tumor segmentation from MRI scans
"""

import os
import numpy as np
import cv2
import nibabel as nib
import tensorflow as tf
from keras import models
import warnings
warnings.filterwarnings('ignore')

# Configuration
IMG_SIZE = 128
VOLUME_SLICES = 100
VOLUME_START_AT = 22

# Segmentation classes
SEGMENT_CLASSES = {
    0: 'NOT tumor',          # Background or healthy tissue
    1: 'NECROTIC/CORE',      # Non-enhancing tumor core
    2: 'EDEMA',              # Swelling or edema region
    3: 'ENHANCING'           # Enhancing (active) tumor
}

# Custom metrics (needed for loading the model)
def dice_coef(y_true, y_pred, smooth=1.0):
    """General Dice Coefficient (mean across 4 classes)"""
    dice = 0.0
    for i in range(4):
        y_true_f = tf.reshape(y_true[..., i], [-1])
        y_pred_f = tf.reshape(y_pred[..., i], [-1])
        intersection = tf.reduce_sum(y_true_f * y_pred_f)
        union = tf.reduce_sum(y_true_f) + tf.reduce_sum(y_pred_f)
        dice += (2. * intersection + smooth) / (union + smooth)
    return dice / 4.0

def dice_coef_class(y_true, y_pred, class_idx, epsilon=1e-6):
    """Dice Coefficient for specific class"""
    y_true_c = tf.reshape(y_true[..., class_idx], [-1])
    y_pred_c = tf.reshape(y_pred[..., class_idx], [-1])
    intersection = tf.reduce_sum(tf.abs(y_true_c * y_pred_c))
    denom = tf.reduce_sum(tf.square(y_true_c)) + tf.reduce_sum(tf.square(y_pred_c)) + epsilon
    return (2. * intersection) / denom

def dice_coef_necrotic(y_true, y_pred):
    return dice_coef_class(y_true, y_pred, class_idx=1)

def dice_coef_edema(y_true, y_pred):
    return dice_coef_class(y_true, y_pred, class_idx=2)

def dice_coef_enhancing(y_true, y_pred):
    return dice_coef_class(y_true, y_pred, class_idx=3)

def precision(y_true, y_pred):
    """Precision metric"""
    true_positives = tf.reduce_sum(tf.round(tf.clip_by_value(y_true * y_pred, 0, 1)))
    predicted_positives = tf.reduce_sum(tf.round(tf.clip_by_value(y_pred, 0, 1)))
    return true_positives / (predicted_positives + 1e-7)

def sensitivity(y_true, y_pred):
    """Sensitivity/Recall metric"""
    true_positives = tf.reduce_sum(tf.round(tf.clip_by_value(y_true * y_pred, 0, 1)))
    possible_positives = tf.reduce_sum(tf.round(tf.clip_by_value(y_true, 0, 1)))
    return true_positives / (possible_positives + 1e-7)

def specificity(y_true, y_pred):
    """Specificity metric"""
    true_negatives = tf.reduce_sum(tf.round(tf.clip_by_value((1 - y_true) * (1 - y_pred), 0, 1)))
    possible_negatives = tf.reduce_sum(tf.round(tf.clip_by_value(1 - y_true, 0, 1)))
    return true_negatives / (possible_negatives + 1e-7)

class BrainTumorPredictor:
    def __init__(self, model_path):
        """Initialize the predictor with the trained model"""
        self.model_path = model_path
        self.model = None
        self.load_model()

    def load_model(self):
        """Load the trained model with custom metrics"""
        try:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model file not found: {self.model_path}")

            custom_objects = {
                'dice_coef': dice_coef,
                'precision': precision,
                'sensitivity': sensitivity,
                'specificity': specificity,
                'dice_coef_necrotic': dice_coef_necrotic,
                'dice_coef_edema': dice_coef_edema,
                'dice_coef_enhancing': dice_coef_enhancing
            }

            # Handle TensorFlow version compatibility issues
            import warnings
            warnings.filterwarnings('ignore')

            # Import TensorFlow explicitly
            import tensorflow as tf
            print(f"Using TensorFlow version: {tf.__version__}")

            # Try multiple loading strategies for compatibility
            try:
                # Strategy 1: Handle DTypePolicy compatibility issue
                print("Attempting to fix DTypePolicy compatibility...")

                # Create a proper DTypePolicy class for compatibility
                class DTypePolicy:
                    def __init__(self, name='float32'):
                        self.name = name

                    @classmethod
                    def from_config(cls, config):
                        return cls(config.get('name', 'float32'))

                    def get_config(self):
                        return {'name': self.name}

                # Add DTypePolicy to custom objects
                custom_objects['DTypePolicy'] = DTypePolicy

                with tf.keras.utils.custom_object_scope(custom_objects):
                    self.model = tf.keras.models.load_model(self.model_path, compile=False)
                print(f"✅ Model loaded successfully from {self.model_path} (Strategy 1 - DTypePolicy fix)")

            except Exception as e1:
                print(f"Strategy 1 failed: {str(e1)}")
                try:
                    # Strategy 2: Try loading with weights only approach
                    print("Attempting to load model architecture and weights separately...")

                    # Try to load just the weights if we can reconstruct the architecture
                    import h5py
                    with h5py.File(self.model_path, 'r') as f:
                        if 'model_config' in f.attrs:
                            import json
                            model_config = json.loads(f.attrs['model_config'].decode('utf-8'))

                            # Fix DTypePolicy in config
                            def fix_dtype_policy(obj):
                                if isinstance(obj, dict):
                                    if obj.get('class_name') == 'DTypePolicy':
                                        return obj.get('config', {}).get('name', 'float32')
                                    return {k: fix_dtype_policy(v) for k, v in obj.items()}
                                elif isinstance(obj, list):
                                    return [fix_dtype_policy(item) for item in obj]
                                return obj

                            # Apply the fix to the model config
                            fixed_config = fix_dtype_policy(model_config)

                            # Create model from fixed config
                            self.model = tf.keras.models.model_from_json(json.dumps(fixed_config))
                            self.model.load_weights(self.model_path)
                            print(f"✅ Model loaded successfully from {self.model_path} (Strategy 2 - Config fix)")

                except Exception as e2:
                    print(f"Strategy 2 failed: {str(e2)}")
                    print("❌ All loading strategies failed:")
                    print(f"  Strategy 1: {str(e1)}")
                    print(f"  Strategy 2: {str(e2)}")
                    print("This appears to be a TensorFlow version compatibility issue.")
                    print("Please try updating TensorFlow to a newer version or provide a compatible model file.")
                    raise Exception(f"Model loading failed: Original model incompatible with current TensorFlow version")

            if self.model is not None:
                print(f"📊 Model input shape: {self.model.input_shape}")
                print(f"📊 Model output shape: {self.model.output_shape}")

        except Exception as e:
            print(f"❌ Error loading model: {str(e)}")
            raise



    def preprocess_image(self, image_file, slice_index=None):
        """Preprocess a single MRI image"""
        try:
            # Load the NIfTI file
            img = nib.load(image_file).get_fdata()
            
            # Select a specific slice if needed
            if slice_index is not None:
                if slice_index >= img.shape[2]:
                    slice_index = img.shape[2] - 1
                img = img[:, :, slice_index]
            
            # Resize the image to (IMG_SIZE, IMG_SIZE)
            img_resized = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
            
            # Normalize the image
            if np.max(img_resized) > 0:
                img_resized = img_resized / np.max(img_resized)
            
            return img_resized
            
        except Exception as e:
            print(f"❌ Error preprocessing image {image_file}: {str(e)}")
            return None
    
    def predict_single_slice(self, flair_path, t1ce_path, slice_index):
        """Predict segmentation for a single slice"""
        try:
            # Prepare input array
            X = np.zeros((1, IMG_SIZE, IMG_SIZE, 2))

            # Process FLAIR and T1CE images
            flair_slice = self.preprocess_image(flair_path, slice_index)
            t1ce_slice = self.preprocess_image(t1ce_path, slice_index)

            if flair_slice is None or t1ce_slice is None:
                return None, None

            X[0, :, :, 0] = flair_slice
            X[0, :, :, 1] = t1ce_slice

            # Make prediction
            if self.model is not None:
                pred = self.model.predict(X, verbose=0)
            else:
                raise Exception("Model not loaded")

            # Return argmax prediction (class with highest probability)
            return np.argmax(pred[0], axis=-1), pred[0]

        except Exception as e:
            print(f"❌ Error during prediction: {str(e)}")
            return None, None
    
    def predict_volume(self, flair_path, t1ce_path, start_slice=VOLUME_START_AT, num_slices=VOLUME_SLICES):
        """Predict segmentation for multiple slices"""
        try:
            # Load full volumes
            flair = nib.load(flair_path).get_fdata()
            t1ce = nib.load(t1ce_path).get_fdata()

            # Prepare input array
            X = np.zeros((num_slices, IMG_SIZE, IMG_SIZE, 2))

            # Process each slice
            for i in range(num_slices):
                slice_idx = start_slice + i
                if slice_idx < flair.shape[2]:
                    # Resize and normalize
                    flair_slice = cv2.resize(flair[:, :, slice_idx], (IMG_SIZE, IMG_SIZE))
                    t1ce_slice = cv2.resize(t1ce[:, :, slice_idx], (IMG_SIZE, IMG_SIZE))

                    X[i, :, :, 0] = flair_slice
                    X[i, :, :, 1] = t1ce_slice

            # Normalize
            if np.max(X) > 0:
                X = X / np.max(X)

            # Make predictions
            if self.model is not None:
                predictions = self.model.predict(X, verbose=1)
            else:
                raise Exception("Model not loaded")

            return predictions

        except Exception as e:
            print(f"❌ Error during volume prediction: {str(e)}")
            return None

def main():
    """Example usage of the BrainTumorPredictor"""

    # Initialize predictor
    model_path = "best_model.h5"

    if not os.path.exists(model_path):
        print(f"❌ Model file not found: {model_path}")
        print("Please make sure the model file is in the current directory.")
        return

    try:
        predictor = BrainTumorPredictor(model_path)
        print("\n🧠 Brain Tumor Segmentation Predictor Ready!")
        print("\nTo use this predictor, you need:")
        print("1. FLAIR MRI scan (.nii file)")
        print("2. T1CE MRI scan (.nii file)")
        print("\nExample usage:")
        print("prediction, probabilities = predictor.predict_single_slice('flair.nii', 't1ce.nii', slice_index=75)")

    except Exception as e:
        print(f"❌ Failed to initialize predictor: {str(e)}")
        raise

if __name__ == "__main__":
    main()
