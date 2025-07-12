/**
 * Dashboard JavaScript
 * Handles dashboard functionality, navigation, and data management
 */

class DashboardManager {
    constructor() {
        this.currentUser = null;
        this.analyses = [];
        this.init();
    }

    init() {
        this.checkAuthentication();
        this.setupEventListeners();
        this.loadDashboardData();
        this.setupNavigation();
    }

    checkAuthentication() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            // Redirect to login if not authenticated
            window.location.href = '/login';
            return;
        }

        // Verify token validity (in a real app, this would be an API call)
        this.currentUser = {
            id: 1,
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@hospital.com',
            specialty: 'Radiology',
            institution: 'General Hospital'
        };

        this.updateUserInterface();
    }

    updateUserInterface() {
        if (!this.currentUser) return;

        // Update user name in navigation
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = `Dr. ${this.currentUser.firstName} ${this.currentUser.lastName}`;
        }


    }

    setupEventListeners() {
        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }

        // New analysis buttons
        const newAnalysisBtn = document.getElementById('new-analysis-btn');
        if (newAnalysisBtn) {
            newAnalysisBtn.addEventListener('click', () => {
                this.showAnalysisSection();
            });
        }

        const newAnalysisBtnResults = document.getElementById('new-analysis-btn-results');
        if (newAnalysisBtnResults) {
            newAnalysisBtnResults.addEventListener('click', () => {
                this.startNewAnalysis();
            });
        }

        // Analysis functionality
        this.setupAnalysisEventListeners();



        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.getAttribute('href').startsWith('#')) {
                    e.preventDefault();
                    this.handleNavigation(link.getAttribute('href').substring(1));
                }
            });
        });

        // Analysis navigation
        const navAnalysis = document.getElementById('nav-analysis');
        if (navAnalysis) {
            navAnalysis.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAnalysisSection();
                this.setActiveNavItem('analysis');
            });
        }
    }

    setupNavigation() {
        // Set active navigation item based on current section
        const currentSection = window.location.hash.substring(1) || 'dashboard';
        this.setActiveNavItem(currentSection);
    }

    setActiveNavItem(section) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${section}`) {
                link.classList.add('active');
            }
        });
    }

    handleNavigation(section) {
        this.setActiveNavItem(section);
        
        switch (section) {
            case 'dashboard':
                this.showDashboard();
                break;
            case 'analysis':
                this.navigateToAnalysis();
                break;
            case 'history':
                this.showHistory();
                break;
            case 'reports':
                this.showReports();
                break;
            default:
                this.showDashboard();
        }
    }

    async loadDashboardData() {
        try {
            await this.loadStatistics();
            await this.loadRecentAnalyses();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showAlert('Error loading dashboard data', 'danger');
        }
    }

    async loadStatistics() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/user/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const stats = data.stats;

                // Update stats cards
                const totalAnalysesElement = document.getElementById('total-analyses');
                const completedAnalysesElement = document.getElementById('completed-analyses');
                const tumorDetectedElement = document.getElementById('tumor-detected');
                const reportsGeneratedElement = document.getElementById('reports-generated');

                if (totalAnalysesElement) totalAnalysesElement.textContent = stats.total_analyses;
                if (completedAnalysesElement) completedAnalysesElement.textContent = stats.completed_analyses;
                if (tumorDetectedElement) tumorDetectedElement.textContent = stats.tumor_detected;
                if (reportsGeneratedElement) reportsGeneratedElement.textContent = stats.reports_generated;

                // Add animation
                this.animateNumbers();
            } else {
                // Fallback to default values
                this.loadDefaultStatistics();
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
            this.loadDefaultStatistics();
        }
    }

    loadDefaultStatistics() {
        // Default stats for new users or when API fails
        const stats = {
            totalAnalyses: 0,
            completedAnalyses: 0,
            tumorDetected: 0,
            reportsGenerated: 0
        };

        const totalAnalysesElement = document.getElementById('total-analyses');
        const completedAnalysesElement = document.getElementById('completed-analyses');
        const tumorDetectedElement = document.getElementById('tumor-detected');
        const reportsGeneratedElement = document.getElementById('reports-generated');

        if (totalAnalysesElement) totalAnalysesElement.textContent = stats.totalAnalyses;
        if (completedAnalysesElement) completedAnalysesElement.textContent = stats.completedAnalyses;
        if (tumorDetectedElement) tumorDetectedElement.textContent = stats.tumorDetected;
        if (reportsGeneratedElement) reportsGeneratedElement.textContent = stats.reportsGenerated;
    }

    async loadRecentAnalyses() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/analyses?limit=10', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.analyses = data.analyses.map(analysis => ({
                    id: analysis.id,
                    date: analysis.date.split('T')[0], // Format date
                    patientId: analysis.patient_id,
                    slice: analysis.slice_index,
                    status: analysis.status,
                    result: analysis.result,
                    tumorPercentage: analysis.tumor_percentage
                }));
            } else {
                // Fallback to empty array for new users
                this.analyses = [];
            }
        } catch (error) {
            console.error('Error loading recent analyses:', error);
            this.analyses = [];
        }

        this.renderRecentAnalyses();
    }

    renderRecentAnalyses() {
        const tbody = document.getElementById('recent-analyses');
        const noAnalyses = document.getElementById('no-analyses');
        const analysesTable = document.getElementById('analyses-table');
        const historyCount = document.getElementById('history-count');

        if (!tbody) return;

        // Update history count
        if (historyCount) {
            historyCount.innerHTML = `
                <i class="fas fa-database me-1"></i>
                ${this.analyses.length} Record${this.analyses.length !== 1 ? 's' : ''}
            `;
        }

        // Show/hide empty state
        if (this.analyses.length === 0) {
            if (noAnalyses) noAnalyses.style.display = 'block';
            if (analysesTable) analysesTable.style.display = 'none';
            return;
        } else {
            if (noAnalyses) noAnalyses.style.display = 'none';
            if (analysesTable) analysesTable.style.display = 'block';
        }

        tbody.innerHTML = '';

        this.analyses.forEach((analysis, index) => {
            const row = document.createElement('tr');
            row.style.animationDelay = `${index * 0.1}s`;
            row.className = 'fade-in-row';

            row.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <i class="fas fa-calendar-alt me-2 text-muted"></i>
                        <span>${analysis.date}</span>
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <i class="fas fa-user-tag me-2 text-muted"></i>
                        <span class="fw-semibold">${analysis.patientId}</span>
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <i class="fas fa-layer-group me-2 text-muted"></i>
                        <span>${analysis.slice}</span>
                    </div>
                </td>
                <td>${this.getStatusBadge(analysis.status)}</td>
                <td>${this.getResultBadge(analysis.result)}</td>
                <td>${this.getActionButtons(analysis)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    getStatusBadge(status) {
        const badges = {
            completed: '<span class="badge bg-success">Completed</span>',
            processing: '<span class="badge bg-primary">Processing</span>',
            failed: '<span class="badge bg-danger">Failed</span>',
            pending: '<span class="badge bg-warning">Pending</span>'
        };
        return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
    }

    getResultBadge(result) {
        const badges = {
            tumor_detected: '<span class="badge bg-warning">Tumor Detected</span>',
            normal: '<span class="badge bg-success">Normal</span>',
            pending: '<span class="badge bg-secondary">Pending</span>'
        };
        return badges[result] || '<span class="badge bg-secondary">Unknown</span>';
    }

    getActionButtons(analysis) {
        if (analysis.status === 'completed') {
            return `
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-primary" onclick="dashboard.viewAnalysis('${analysis.id}')" title="View Analysis">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success" onclick="dashboard.downloadReport('${analysis.id}')" title="Download Report">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="dashboard.deleteAnalysis('${analysis.id}')" title="Delete Analysis">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        } else if (analysis.status === 'processing') {
            return `
                <button class="btn btn-sm btn-outline-secondary" disabled title="Processing">
                    <i class="fas fa-clock"></i>
                </button>
            `;
        } else {
            return `
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-warning" onclick="dashboard.retryAnalysis('${analysis.id}')" title="Retry Analysis">
                        <i class="fas fa-redo"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="dashboard.deleteAnalysis('${analysis.id}')" title="Delete Analysis">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }
    }

    animateNumbers() {
        document.querySelectorAll('.stats-number').forEach(element => {
            const target = parseInt(element.textContent);
            let current = 0;
            const increment = target / 20;
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    element.textContent = target;
                    clearInterval(timer);
                } else {
                    element.textContent = Math.floor(current);
                }
            }, 50);
        });
    }

    navigateToAnalysis() {
        // Navigate to the main analysis page
        window.location.href = '/';
    }

    showDashboard() {
        // Already on dashboard, just refresh data
        this.loadDashboardData();
    }

    showHistory() {
        this.showAlert('History view will be implemented soon!', 'info');
    }



    async viewAnalysis(id) {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/analyses/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const analysis = data.analysis;

                // Display the analysis results
                this.displayResults(analysis);
                this.showResults();

                // Scroll to results
                document.getElementById('results-section').scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });

                this.showAlert('Analysis loaded successfully!', 'success');
            } else {
                this.showAlert('Failed to load analysis', 'danger');
            }
        } catch (error) {
            console.error('Error viewing analysis:', error);
            this.showAlert('Error loading analysis', 'danger');
        }
    }

    async downloadReport(id) {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/analyses/${id}/download`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.showAlert(data.message || 'Report download initiated', 'info');

                // For now, show the analysis and let user download from there
                this.viewAnalysis(id);
            } else {
                this.showAlert('Failed to download report', 'danger');
            }
        } catch (error) {
            console.error('Error downloading report:', error);
            this.showAlert('Error downloading report', 'danger');
        }
    }

    async deleteAnalysis(id) {
        // Confirm deletion
        if (!confirm('Are you sure you want to delete this analysis? This action cannot be undone.')) {
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/analyses/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                // Remove from local array
                this.analyses = this.analyses.filter(a => a.id !== id);

                // Re-render table
                this.renderRecentAnalyses();

                // Update statistics
                this.loadStatistics();

                this.showAlert('Analysis deleted successfully', 'success');
            } else {
                this.showAlert('Failed to delete analysis', 'danger');
            }
        } catch (error) {
            console.error('Error deleting analysis:', error);
            this.showAlert('Error deleting analysis', 'danger');
        }
    }

    retryAnalysis(id) {
        // For now, just show the analysis section for a new analysis
        this.showAnalysisSection();
        this.showAlert('Please upload new files to retry the analysis', 'info');
    }

    handleLogout() {
        // Clear authentication data
        localStorage.removeItem('authToken');
        
        // Show logout message
        this.showAlert('Logged out successfully!', 'success');
        
        // Redirect to login page
        setTimeout(() => {
            window.location.href = '/login';
        }, 1500);
    }

    setupAnalysisEventListeners() {
        // File upload handlers
        const flairFile = document.getElementById('flair-file');
        const t1ceFile = document.getElementById('t1ce-file');

        if (flairFile) {
            flairFile.addEventListener('change', (e) => {
                this.handleFileUpload(e, 'flair');
                this.validateFiles();
            });
        }

        if (t1ceFile) {
            t1ceFile.addEventListener('change', (e) => {
                this.handleFileUpload(e, 't1ce');
                this.validateFiles();
            });
        }

        // Analysis button
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                this.analyzeImages();
            });
        }

        // Download report buttons
        document.addEventListener('click', (e) => {
            if (e.target.id === 'download-report') {
                this.downloadTextReport();
            }
            if (e.target.id === 'download-jpg-report') {
                this.downloadJPGReport();
            }
            if (e.target.id === 'fullscreen-btn') {
                this.toggleFullscreen();
            }
            if (e.target.id === 'toggle-analysis') {
                this.toggleAnalysisSection();
            }
        });
    }

    handleFileUpload(event, type) {
        const file = event.target.files[0];
        const statusElement = document.getElementById(`${type}-status`);

        if (file) {
            const fileName = file.name;
            const fileSize = (file.size / 1024 / 1024).toFixed(2);

            if (fileName.endsWith('.nii') || fileName.endsWith('.nii.gz')) {
                statusElement.innerHTML = `<i class="fas fa-check-circle text-success"></i> ${fileName} (${fileSize} MB)`;
                statusElement.className = 'upload-status success';
            } else {
                statusElement.innerHTML = `<i class="fas fa-exclamation-triangle text-warning"></i> Please select a .nii or .nii.gz file`;
                statusElement.className = 'upload-status error';
            }
        } else {
            statusElement.innerHTML = '';
            statusElement.className = 'upload-status';
        }
    }

    validateFiles() {
        const flairFile = document.getElementById('flair-file');
        const t1ceFile = document.getElementById('t1ce-file');
        const analyzeBtn = document.getElementById('analyze-btn');

        if (flairFile && t1ceFile && analyzeBtn) {
            const hasFiles = flairFile.files[0] && t1ceFile.files[0];
            analyzeBtn.disabled = !hasFiles;

            if (hasFiles) {
                analyzeBtn.classList.remove('btn-secondary');
                analyzeBtn.classList.add('btn-primary');
            } else {
                analyzeBtn.classList.remove('btn-primary');
                analyzeBtn.classList.add('btn-secondary');
            }
        }
    }

    async analyzeImages() {
        const flairFile = document.getElementById('flair-file');
        const t1ceFile = document.getElementById('t1ce-file');
        const sliceIndex = document.getElementById('slice-index');
        const patientId = document.getElementById('patient-id');

        if (!flairFile.files[0] || !t1ceFile.files[0]) {
            this.showAlert('Please select both FLAIR and T1CE files.', 'warning');
            return;
        }

        // Show progress
        this.showProgress();
        this.hideResults();

        try {
            // Prepare form data
            const formData = new FormData();
            formData.append('flair', flairFile.files[0]);
            formData.append('t1ce', t1ceFile.files[0]);
            formData.append('slice_index', sliceIndex.value);
            formData.append('patient_id', patientId.value);

            // Get auth token
            const token = localStorage.getItem('authToken');

            // Make API request
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                this.displayResults(data);

                // Refresh history and statistics from backend
                await this.loadRecentAnalyses();
                await this.loadStatistics();

                this.showAlert('Analysis completed successfully!', 'success');
            } else {
                throw new Error(data.error || 'Analysis failed');
            }
        } catch (error) {
            console.error('Analysis error:', error);
            this.showAlert(`Analysis failed: ${error.message}`, 'danger');
        } finally {
            this.hideProgress();
        }
    }

    displayResults(data) {
        // Display visualization
        const resultImage = document.getElementById('result-image');
        if (resultImage) {
            resultImage.src = `data:image/png;base64,${data.visualization}`;
        }

        // Calculate metrics
        const classStats = data.class_statistics || {};
        const totalPixels = Object.values(classStats).reduce((sum, count) => sum + count, 0);
        const tumorPixels = (classStats[1] || 0) + (classStats[2] || 0) + (classStats[3] || 0);
        const tumorPercentage = totalPixels > 0 ? ((tumorPixels / totalPixels) * 100).toFixed(1) : 0;
        const hasSignificantTumor = tumorPixels > 1000;

        // Update timestamp
        const timestampElement = document.getElementById('analysis-timestamp');
        if (timestampElement) {
            const now = new Date();
            timestampElement.innerHTML = `
                <i class="fas fa-clock me-1"></i>
                ${now.toLocaleTimeString()}
            `;
        }

        // Update metrics
        this.updateMetrics(data.slice_index, tumorPercentage, totalPixels, tumorPixels);

        // Display tumor status
        const tumorStatus = document.getElementById('tumor-status');
        if (tumorStatus) {
            if (tumorPercentage > 5) {
                tumorStatus.className = 'status-alert alert-danger';
                tumorStatus.innerHTML = `
                    <div class="d-flex align-items-center">
                        <i class="fas fa-exclamation-triangle me-3" style="font-size: 1.5rem;"></i>
                        <div>
                            <strong>Significant Tumor Detected</strong><br>
                            <small>High tumor burden identified - ${tumorPercentage}% of slice affected</small>
                        </div>
                    </div>
                `;
            } else if (tumorPercentage > 1) {
                tumorStatus.className = 'status-alert alert-warning';
                tumorStatus.innerHTML = `
                    <div class="d-flex align-items-center">
                        <i class="fas fa-exclamation-circle me-3" style="font-size: 1.5rem;"></i>
                        <div>
                            <strong>Moderate Tumor Activity</strong><br>
                            <small>Tumor regions detected - ${tumorPercentage}% of slice affected</small>
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
                            <small>Low tumor presence detected - ${tumorPercentage}% of slice affected</small>
                        </div>
                    </div>
                `;
            }
        }

        // Display tissue breakdown
        this.displayTissueBreakdown(data.class_statistics);

        // Store data for download
        this.currentResults = data;

        // Show results section
        this.showResults();
    }

    updateMetrics(sliceIndex, tumorPercentage, totalPixels, tumorPixels) {
        // Update tumor percentage
        const tumorPercentageElement = document.getElementById('tumor-percentage');
        if (tumorPercentageElement) {
            tumorPercentageElement.textContent = `${tumorPercentage}%`;
        }

        // Update slice analyzed
        const sliceAnalyzedElement = document.getElementById('slice-analyzed');
        if (sliceAnalyzedElement) {
            sliceAnalyzedElement.textContent = sliceIndex;
        }

        // Update total pixels
        const totalPixelsElement = document.getElementById('total-pixels');
        if (totalPixelsElement) {
            totalPixelsElement.textContent = totalPixels.toLocaleString();
        }

        // Update tumor pixels
        const tumorPixelsElement = document.getElementById('tumor-pixels');
        if (tumorPixelsElement) {
            tumorPixelsElement.textContent = tumorPixels.toLocaleString();
        }
    }

    displayTissueBreakdown(classStats) {
        const tissueBreakdown = document.getElementById('tissue-breakdown');
        if (!tissueBreakdown) return;

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

    showProgress() {
        const progressSection = document.getElementById('progress-section');
        if (progressSection) {
            progressSection.style.display = 'block';
            progressSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    hideProgress() {
        const progressSection = document.getElementById('progress-section');
        if (progressSection) {
            progressSection.style.display = 'none';
        }
    }

    showResults() {
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    hideResults() {
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
            resultsSection.style.display = 'none';
        }
    }

    showAnalysisSection() {
        const analysisSection = document.getElementById('analysis-section');
        if (analysisSection) {
            analysisSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    toggleAnalysisSection() {
        const analysisContent = document.getElementById('analysis-content');
        const toggleBtn = document.getElementById('toggle-analysis');

        if (analysisContent && toggleBtn) {
            if (analysisContent.style.display === 'none') {
                analysisContent.style.display = 'block';
                toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
                toggleBtn.classList.remove('collapsed');
            } else {
                analysisContent.style.display = 'none';
                toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
                toggleBtn.classList.add('collapsed');
            }
        }
    }

    startNewAnalysis() {
        // Clear form
        const flairFile = document.getElementById('flair-file');
        const t1ceFile = document.getElementById('t1ce-file');
        const patientId = document.getElementById('patient-id');

        if (flairFile) flairFile.value = '';
        if (t1ceFile) t1ceFile.value = '';
        if (patientId) patientId.value = '';

        // Clear status
        const flairStatus = document.getElementById('flair-status');
        const t1ceStatus = document.getElementById('t1ce-status');

        if (flairStatus) flairStatus.innerHTML = '';
        if (t1ceStatus) t1ceStatus.innerHTML = '';

        // Hide results and show analysis
        this.hideResults();
        this.showAnalysisSection();

        // Reset validation
        this.validateFiles();
    }

    toggleFullscreen() {
        const resultImage = document.getElementById('result-image');
        if (resultImage) {
            if (resultImage.requestFullscreen) {
                resultImage.requestFullscreen();
            } else if (resultImage.webkitRequestFullscreen) {
                resultImage.webkitRequestFullscreen();
            } else if (resultImage.msRequestFullscreen) {
                resultImage.msRequestFullscreen();
            }
        }
    }

    async downloadTextReport() {
        if (!this.currentResults) {
            this.showAlert('No results to download.', 'warning');
            return;
        }

        try {
            const reportContent = this.generateReportContent(this.currentResults);
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
            const downloadBtn = document.getElementById('download-jpg-report');
            const originalText = downloadBtn.innerHTML;
            downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating...';
            downloadBtn.disabled = true;

            const formData = new FormData();
            const flairFile = document.getElementById('flair-file');
            const t1ceFile = document.getElementById('t1ce-file');

            formData.append('flair', flairFile.files[0]);
            formData.append('t1ce', t1ceFile.files[0]);
            formData.append('slice_index', this.currentResults.slice_index);

            const response = await fetch('/api/download-report', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate report');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

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
            const downloadBtn = document.getElementById('download-jpg-report');
            downloadBtn.innerHTML = '<i class="fas fa-image me-2"></i>JPG Report';
            downloadBtn.disabled = false;
        }
    }

    generateReportContent(data) {
        const timestamp = new Date().toLocaleString();

        let content = `BRAIN TUMOR SEGMENTATION REPORT\n`;
        content += `Generated: ${timestamp}\n`;
        content += `Slice Index: ${data.slice_index}\n`;
        content += `${'='.repeat(50)}\n\n`;

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
        alertDiv.style.cssText = 'top: 90px; right: 20px; z-index: 9999; max-width: 400px;';

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

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new DashboardManager();
});

// Export for external use
window.DashboardManager = DashboardManager;
