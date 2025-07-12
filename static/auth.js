/**
 * Authentication JavaScript
 * Handles login, registration, and form validation
 */

class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupPasswordToggles();
        this.setupPasswordStrength();
        this.setupFormValidation();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Registration form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Social login buttons
        document.querySelectorAll('.btn-social').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleSocialLogin(e));
        });
    }

    setupPasswordToggles() {
        document.querySelectorAll('.password-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = toggle.getAttribute('data-target');
                const passwordField = document.getElementById(targetId);
                const icon = toggle.querySelector('i');

                if (passwordField.type === 'password') {
                    passwordField.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    passwordField.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        });
    }

    setupPasswordStrength() {
        const passwordField = document.getElementById('password');
        if (passwordField) {
            passwordField.addEventListener('input', (e) => {
                this.checkPasswordStrength(e.target.value);
            });
        }
    }

    checkPasswordStrength(password) {
        const strengthContainer = document.querySelector('.password-strength');
        if (!strengthContainer) return;

        const strengthText = strengthContainer.querySelector('.strength-text');
        const strengthBar = strengthContainer.querySelector('.strength-bar');

        // Remove existing classes
        strengthBar.className = 'strength-bar';

        let strength = 0;
        let feedback = 'Password strength';

        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        switch (strength) {
            case 0:
            case 1:
                strengthBar.classList.add('strength-weak');
                feedback = 'Weak password';
                break;
            case 2:
                strengthBar.classList.add('strength-fair');
                feedback = 'Fair password';
                break;
            case 3:
            case 4:
                strengthBar.classList.add('strength-good');
                feedback = 'Good password';
                break;
            case 5:
                strengthBar.classList.add('strength-strong');
                feedback = 'Strong password';
                break;
        }

        strengthText.textContent = feedback;
    }

    setupFormValidation() {
        // Real-time validation for email
        const emailFields = document.querySelectorAll('input[type="email"]');
        emailFields.forEach(field => {
            field.addEventListener('blur', () => this.validateEmail(field));
            field.addEventListener('input', () => this.clearValidation(field));
        });

        // Password confirmation validation
        const confirmPassword = document.getElementById('confirmPassword');
        if (confirmPassword) {
            confirmPassword.addEventListener('blur', () => this.validatePasswordMatch());
            confirmPassword.addEventListener('input', () => this.clearValidation(confirmPassword));
        }

        // Required field validation
        const requiredFields = document.querySelectorAll('input[required], select[required]');
        requiredFields.forEach(field => {
            field.addEventListener('blur', () => this.validateRequired(field));
            field.addEventListener('input', () => this.clearValidation(field));
        });
    }

    validateEmail(field) {
        const email = field.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            this.showFieldError(field, 'Email is required');
            return false;
        }

        if (!emailRegex.test(email)) {
            this.showFieldError(field, 'Please enter a valid email address');
            return false;
        }

        this.showFieldSuccess(field);
        return true;
    }

    validateRequired(field) {
        const value = field.value.trim();

        if (!value) {
            this.showFieldError(field, `${this.getFieldLabel(field)} is required`);
            return false;
        }

        this.showFieldSuccess(field);
        return true;
    }

    validatePasswordMatch() {
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');

        if (!password || !confirmPassword) return true;

        if (password.value !== confirmPassword.value) {
            this.showFieldError(confirmPassword, 'Passwords do not match');
            return false;
        }

        this.showFieldSuccess(confirmPassword);
        return true;
    }

    getFieldLabel(field) {
        const label = document.querySelector(`label[for="${field.id}"]`);
        return label ? label.textContent.replace('*', '').trim() : field.name;
    }

    showFieldError(field, message) {
        field.classList.remove('is-valid');
        field.classList.add('is-invalid');
        
        const feedback = field.parentNode.parentNode.querySelector('.invalid-feedback');
        if (feedback) {
            feedback.textContent = message;
        }
    }

    showFieldSuccess(field) {
        field.classList.remove('is-invalid');
        field.classList.add('is-valid');
        
        const feedback = field.parentNode.parentNode.querySelector('.invalid-feedback');
        if (feedback) {
            feedback.textContent = '';
        }
    }

    clearValidation(field) {
        field.classList.remove('is-invalid', 'is-valid');
        
        const feedback = field.parentNode.parentNode.querySelector('.invalid-feedback');
        if (feedback) {
            feedback.textContent = '';
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const loginBtn = document.getElementById('login-btn');

        // Validate form
        if (!this.validateLoginForm(form)) {
            return;
        }

        // Show loading state
        this.setButtonLoading(loginBtn, true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: formData.get('email'),
                    password: formData.get('password'),
                    remember: formData.get('remember') === 'on'
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('Login successful! Redirecting...', 'success');
                
                // Store auth token if provided
                if (data.token) {
                    localStorage.setItem('authToken', data.token);
                }

                // Redirect to dashboard or main app
                setTimeout(() => {
                    window.location.href = data.redirect || '/dashboard';
                }, 1500);
            } else {
                this.showAlert(data.error || 'Login failed. Please try again.', 'danger');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showAlert('Network error. Please check your connection and try again.', 'danger');
        } finally {
            this.setButtonLoading(loginBtn, false);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const registerBtn = document.getElementById('register-btn');

        // Validate form
        if (!this.validateRegisterForm(form)) {
            return;
        }

        // Show loading state
        this.setButtonLoading(registerBtn, true);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    firstName: formData.get('firstName'),
                    lastName: formData.get('lastName'),
                    email: formData.get('email'),
                    institution: formData.get('institution'),
                    specialty: formData.get('specialty'),
                    password: formData.get('password'),
                    newsletter: formData.get('newsletter') === 'on'
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('Registration successful! Please check your email to verify your account.', 'success');
                
                // Redirect to login page after delay
                setTimeout(() => {
                    window.location.href = '/login';
                }, 3000);
            } else {
                this.showAlert(data.error || 'Registration failed. Please try again.', 'danger');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showAlert('Network error. Please check your connection and try again.', 'danger');
        } finally {
            this.setButtonLoading(registerBtn, false);
        }
    }

    validateLoginForm(form) {
        const email = form.querySelector('#email');
        const password = form.querySelector('#password');

        let isValid = true;

        // For demo: just check if fields are not empty
        if (!email.value.trim()) {
            this.showFieldError(email, 'Please enter any email address');
            isValid = false;
        } else {
            this.showFieldSuccess(email);
        }

        if (!password.value.trim()) {
            this.showFieldError(password, 'Please enter any password');
            isValid = false;
        } else {
            this.showFieldSuccess(password);
        }

        return isValid;
    }

    validateRegisterForm(form) {
        const firstName = form.querySelector('#firstName');
        const lastName = form.querySelector('#lastName');
        const email = form.querySelector('#email');
        const password = form.querySelector('#password');
        const confirmPassword = form.querySelector('#confirmPassword');
        const terms = form.querySelector('#terms');

        let isValid = true;

        if (!this.validateRequired(firstName)) isValid = false;
        if (!this.validateRequired(lastName)) isValid = false;
        if (!this.validateEmail(email)) isValid = false;
        if (!this.validateRequired(password)) isValid = false;
        if (!this.validatePasswordMatch()) isValid = false;

        // Check password strength
        if (password.value.length < 8) {
            this.showFieldError(password, 'Password must be at least 8 characters long');
            isValid = false;
        }

        // Check terms acceptance
        if (!terms.checked) {
            this.showAlert('Please accept the Terms of Service and Privacy Policy', 'warning');
            isValid = false;
        }

        return isValid;
    }

    handleSocialLogin(e) {
        e.preventDefault();
        const provider = e.currentTarget.classList.contains('btn-google') ? 'google' : 'microsoft';
        
        this.showAlert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login will be available soon!`, 'info');
    }

    setButtonLoading(button, loading) {
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
            const icon = button.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-spinner fa-spin me-2';
            }
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            const icon = button.querySelector('i');
            if (icon) {
                // Restore original icon based on button type
                if (button.id === 'login-btn') {
                    icon.className = 'fas fa-sign-in-alt me-2';
                } else if (button.id === 'register-btn') {
                    icon.className = 'fas fa-user-plus me-2';
                }
            }
        }
    }

    showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alert-container');
        if (!alertContainer) return;

        // Remove existing alerts
        alertContainer.innerHTML = '';

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        alertContainer.appendChild(alertDiv);

        // Auto-remove after 5 seconds for non-error messages
        if (type !== 'danger') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }

        // Scroll to alert
        alertDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});

// Export for potential external use
window.AuthManager = AuthManager;
