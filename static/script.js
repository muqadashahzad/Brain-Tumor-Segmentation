// Brain Tumor Segmentation Tool - JavaScript

class BrainTumorApp {
    constructor() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.init();
        this.checkModelStatus();
        this.checkAuthentication();
    }

    init() {
        // Get DOM elements
        this.uploadForm = document.getElementById('upload-form');
        this.flairFile = document.getElementById('flair-file');
        this.t1ceFile = document.getElementById('t1ce-file');
        this.sliceIndex = document.getElementById('slice-index');
        this.analyzeBtn = document.getElementById('analyze-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.progressSection = document.getElementById('progress-section');
        this.resultsSection = document.getElementById('results-section');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');
        this.resultImage = document.getElementById('result-image');

        // Bind events
        this.bindEvents();
    }

    checkAuthentication() {
        const token = localStorage.getItem('authToken');
        const userData = localStorage.getItem('userData');

        if (token && userData) {
            try {
                this.currentUser = JSON.parse(userData);
                this.isAuthenticated = true;
                this.updateUIForAuthenticatedUser();

                // Redirect to dashboard for SaaS experience
                if (window.location.pathname === '/') {
                    window.location.href = '/dashboard';
                    return;
                }
            } catch (e) {
                console.error('Error parsing user data:', e);
                this.logout();
            }
        } else {
            this.updateUIForGuestUser();
        }
    }

    updateUIForAuthenticatedUser() {
        // Update user display elements
        const userNameElements = document.querySelectorAll('[data-user-name]');
        userNameElements.forEach(element => {
            if (this.currentUser) {
                element.textContent = `Dr. ${this.currentUser.firstName} ${this.currentUser.lastName}`;
            }
        });

        // Show/hide navigation elements
        document.querySelectorAll('.auth-required').forEach(el => {
            el.style.display = 'block';
        });

        document.querySelectorAll('.guest-only').forEach(el => {
            el.style.display = 'none';
        });
    }

    updateUIForGuestUser() {
        // Hide authenticated elements
        document.querySelectorAll('.auth-required').forEach(el => {
            el.style.display = 'none';
        });

        // Show guest elements
        document.querySelectorAll('.guest-only').forEach(el => {
            el.style.display = 'block';
        });
    }

    logout() {
        this.isAuthenticated = false;
        this.currentUser = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        this.updateUIForGuestUser();

        // Show logout message
        this.showAlert('Logged out successfully!', 'success');

        // Redirect to login page after delay
        setTimeout(() => {
            window.location.href = '/login';
        }, 1500);
    }

    bindEvents() {
        // Logout handler
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-logout]')) {
                e.preventDefault();
                this.logout();
            }
        });

        // Form submission
        if (this.uploadForm) {
            this.uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.analyzeImages();
            });
        }

        // Clear button
        this.clearBtn.addEventListener('click', () => {
            this.clearForm();
        });

        // File input changes
        this.flairFile.addEventListener('change', (e) => {
            this.handleFileUpload(e, 'flair');
            this.validateFiles();
        });

        this.t1ceFile.addEventListener('change', (e) => {
            this.handleFileUpload(e, 't1ce');
            this.validateFiles();
        });

        // Download report buttons
        document.addEventListener('click', (e) => {
            if (e.target.id === 'download-report') {
                this.downloadTextReport();
            }
            if (e.target.id === 'download-jpg-report') {
                this.downloadJPGReport();
            }
            if (e.target.id === 'new-analysis-btn') {
                this.startNewAnalysis();
            }
            if (e.target.id === 'fullscreen-btn') {
                this.toggleFullscreen();
            }
        });
    }

    async checkModelStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            if (data.model_loaded) {
                this.updateStatus('success', 'Model Ready');
                this.analyzeBtn.disabled = false;
            } else {
                this.updateStatus('error', 'Model Not Loaded');
                this.analyzeBtn.disabled = true;
            }
        } catch (error) {
            this.updateStatus('error', 'Connection Error');
            this.analyzeBtn.disabled = true;
        }
    }

    updateStatus(type, message) {
        const icon = this.statusIndicator.querySelector('i');
        
        // Remove existing classes
        icon.className = 'fas fa-circle';
        
        switch (type) {
            case 'success':
                icon.classList.add('text-success');
                break;
            case 'error':
                icon.classList.add('text-danger');
                break;
            case 'warning':
                icon.classList.add('text-warning');
                break;
            default:
                icon.classList.add('text-secondary');
        }
        
        this.statusText.textContent = message;
    }

    handleFileUpload(event, type) {
        const file = event.target.files[0];
        const statusElement = document.getElementById(`${type}-status`);
        const uploadZone = event.target.closest('.upload-zone');

        if (file) {
            statusElement.textContent = `✓ ${file.name}`;
            statusElement.className = 'upload-status success';
            uploadZone.classList.add('active');
        } else {
            statusElement.textContent = '';
            statusElement.className = 'upload-status';
            uploadZone.classList.remove('active');
        }
    }

    validateFiles() {
        const flairValid = this.flairFile.files.length > 0;
        const t1ceValid = this.t1ceFile.files.length > 0;

        this.analyzeBtn.disabled = !(flairValid && t1ceValid);
    }

    async analyzeImages() {
        try {
            // Validate inputs
            if (!this.flairFile.files[0] || !this.t1ceFile.files[0]) {
                this.showAlert('Please select both FLAIR and T1CE files.', 'warning');
                return;
            }

            // Show progress
            this.showProgress();
            this.hideResults();

            // Prepare form data
            const formData = new FormData();
            formData.append('flair', this.flairFile.files[0]);
            formData.append('t1ce', this.t1ceFile.files[0]);
            formData.append('slice_index', this.sliceIndex.value);

            // Make API request
            const response = await fetch('/api/predict', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.displayResults(data);
                this.showAlert('Analysis completed successfully!', 'success');
            } else {
                throw new Error(data.error || 'Analysis failed');
            }

        } catch (error) {
            console.error('Analysis error:', error);
            this.showAlert(`Error: ${error.message}`, 'danger');
        } finally {
            this.hideProgress();
        }
    }

    displayResults(data) {
        // Display visualization
        this.resultImage.src = `data:image/png;base64,${data.visualization}`;

        // Display tumor status with modern styling
        const tumorStatus = document.getElementById('tumor-status');
        const hasSignificantTumor = data.class_statistics && (
            (data.class_statistics[1] || 0) +
            (data.class_statistics[2] || 0) +
            (data.class_statistics[3] || 0)
        ) > 1000; // Threshold for significant tumor presence

        if (hasSignificantTumor) {
            tumorStatus.className = 'status-alert alert-warning';
            tumorStatus.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="fas fa-exclamation-triangle me-3" style="font-size: 1.5rem;"></i>
                    <div>
                        <strong>Tumor Regions Detected</strong><br>
                        <small>Multiple tumor regions identified in this slice</small>
                    </div>
                </div>
            `;
        } else {
            tumorStatus.className = 'status-alert alert-success';
            tumorStatus.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="fas fa-check-circle me-3" style="font-size: 1.5rem;"></i>
                    <div>
                        <strong>Minimal Tumor Activity</strong><br>
                        <small>Low tumor presence detected in this slice</small>
                    </div>
                </div>
            `;
        }

        // Display tissue breakdown with modern styling
        this.displayTissueBreakdown(data.class_statistics);

        // Store data for download
        this.currentResults = data;

        // Show results section with animation
        this.showResults();
    }

    displayTissueBreakdown(classStats) {
        const tissueBreakdown = document.getElementById('tissue-breakdown');
        const tissueNames = ['Background', 'Necrotic/Core', 'Edema', 'Enhancing'];
        const tissueColors = ['text-secondary', 'text-danger', 'text-primary', 'text-success'];

        let breakdownHTML = '';
        let totalPixels = 0;

        // Calculate total pixels
        for (let i = 0; i < 4; i++) {
            totalPixels += classStats[i] || 0;
        }

        // Generate tissue breakdown
        for (let i = 0; i < 4; i++) {
            const pixels = classStats[i] || 0;
            const percentage = totalPixels > 0 ? ((pixels / totalPixels) * 100).toFixed(1) : 0;

            breakdownHTML += `
                <div class="tissue-item">
                    <span>
                        <i class="fas fa-circle ${tissueColors[i]} me-2"></i>
                        ${tissueNames[i]}
                    </span>
                    <span class="tissue-percentage">${percentage}%</span>
                </div>
            `;
        }

        tissueBreakdown.innerHTML = breakdownHTML;
    }

    getTissueColor(tissue) {
        const colorMap = {
            'NOT tumor': 'text-secondary',
            'NECROTIC/CORE': 'text-danger',
            'EDEMA': 'text-primary',
            'ENHANCING': 'text-success'
        };
        return colorMap[tissue] || 'text-dark';
    }

    showProgress() {
        this.progressSection.style.display = 'block';
        this.progressSection.classList.add('fade-in-up');
        this.analyzeBtn.disabled = true;
        this.analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Analyzing...';

        // Scroll to progress section
        this.progressSection.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }

    hideProgress() {
        this.progressSection.style.display = 'none';
        this.analyzeBtn.disabled = false;
        this.analyzeBtn.innerHTML = '<i class="fas fa-brain me-2"></i>Analyze Brain Scan';
    }

    showResults() {
        this.resultsSection.style.display = 'block';
        this.resultsSection.classList.add('fade-in-up');
        
        // Scroll to results
        this.resultsSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }

    hideResults() {
        this.resultsSection.style.display = 'none';
    }

    clearForm() {
        // Reset form
        this.uploadForm.reset();

        // Reset upload zones
        document.querySelectorAll('.upload-zone').forEach(zone => {
            zone.classList.remove('active');
        });

        // Clear upload status
        document.querySelectorAll('.upload-status').forEach(status => {
            status.textContent = '';
            status.className = 'upload-status';
        });

        // Hide results
        this.hideResults();
        this.hideProgress();

        // Reset button state
        this.validateFiles();

        // Clear stored results
        this.currentResults = null;

        this.showAlert('Form cleared successfully.', 'info');
    }

    startNewAnalysis() {
        this.clearForm();
        // Scroll to upload section
        document.getElementById('upload-section').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

    toggleFullscreen() {
        const image = this.resultImage;
        if (image.requestFullscreen) {
            image.requestFullscreen();
        } else if (image.webkitRequestFullscreen) {
            image.webkitRequestFullscreen();
        } else if (image.msRequestFullscreen) {
            image.msRequestFullscreen();
        }
    }

    downloadTextReport() {
        if (!this.currentResults) {
            this.showAlert('No results to download.', 'warning');
            return;
        }

        try {
            // Create report content
            const reportContent = this.generateReportContent(this.currentResults);

            // Create and download file
            const blob = new Blob([reportContent], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `brain_tumor_report_${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.showAlert('Text report downloaded successfully!', 'success');
        } catch (error) {
            this.showAlert('Error downloading text report.', 'danger');
        }
    }

    async downloadJPGReport() {
        if (!this.currentResults) {
            this.showAlert('No results to download.', 'warning');
            return;
        }

        try {
            // Show loading state
            const downloadBtn = document.getElementById('download-jpg-report');
            const originalText = downloadBtn.innerHTML;
            downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating Report...';
            downloadBtn.disabled = true;

            // Prepare form data with the same files used for analysis
            const formData = new FormData();
            formData.append('flair', this.flairFile.files[0]);
            formData.append('t1ce', this.t1ceFile.files[0]);
            formData.append('slice_index', this.currentResults.slice_index);

            // Make API request for JPG report
            const response = await fetch('/api/download-report', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate report');
            }

            // Download the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Extract filename from response headers or create default
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'brain_tumor_report.jpg';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.showAlert('High-quality JPG report downloaded successfully!', 'success');

        } catch (error) {
            console.error('Error downloading JPG report:', error);
            this.showAlert(`Error generating JPG report: ${error.message}`, 'danger');
        } finally {
            // Restore button state
            const downloadBtn = document.getElementById('download-jpg-report');
            downloadBtn.innerHTML = '<i class="fas fa-image me-2"></i>Download JPG Report';
            downloadBtn.disabled = false;
        }
    }

    generateReportContent(data) {
        const timestamp = new Date().toLocaleString();

        let content = `BRAIN TUMOR SEGMENTATION REPORT\n`;
        content += `Generated: ${timestamp}\n`;
        content += `Slice Index: ${data.slice_index}\n`;
        content += `${'='.repeat(50)}\n\n`;

        // Calculate tumor statistics from class_statistics
        const classStats = data.class_statistics || {};
        const totalPixels = Object.values(classStats).reduce((sum, count) => sum + count, 0);
        const tumorPixels = (classStats[1] || 0) + (classStats[2] || 0) + (classStats[3] || 0);
        const tumorPercentage = totalPixels > 0 ? ((tumorPixels / totalPixels) * 100).toFixed(1) : 0;

        content += `TUMOR STATUS:\n`;
        if (tumorPercentage > 5) {
            content += `⚠️  SIGNIFICANT TUMOR DETECTED (${tumorPercentage}% of slice)\n\n`;
        } else if (tumorPercentage > 1) {
            content += `⚠️  MODERATE TUMOR ACTIVITY (${tumorPercentage}% of slice)\n\n`;
        } else {
            content += `✅ MINIMAL TUMOR ACTIVITY (${tumorPercentage}% of slice)\n\n`;
        }

        content += `TISSUE COMPOSITION:\n`;
        const tissueNames = ['Background', 'Necrotic/Core', 'Edema', 'Enhancing'];

        for (let i = 0; i < 4; i++) {
            const pixels = classStats[i] || 0;
            const percentage = totalPixels > 0 ? ((pixels / totalPixels) * 100).toFixed(1) : 0;
            content += `${tissueNames[i]}: ${pixels.toLocaleString()} pixels (${percentage}%)\n`;
        }

        content += `\nTotal Pixels Analyzed: ${totalPixels.toLocaleString()}\n`;
        content += `Tumor Pixels: ${tumorPixels.toLocaleString()}\n`;

        content += `\n${'='.repeat(50)}\n`;
        content += `DISCLAIMER: This analysis is for research purposes only.\n`;
        content += `Not intended for clinical diagnosis.\n`;
        content += `Always consult qualified medical professionals.\n`;

        return content;
    }

    showAlert(message, type = 'info') {
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BrainTumorApp();
});

// Add some utility functions
window.addEventListener('beforeunload', (e) => {
    // Warn user if they're leaving during analysis
    const progressSection = document.getElementById('progress-section');
    if (progressSection && progressSection.style.display !== 'none') {
        e.preventDefault();
        e.returnValue = 'Analysis in progress. Are you sure you want to leave?';
    }
});
