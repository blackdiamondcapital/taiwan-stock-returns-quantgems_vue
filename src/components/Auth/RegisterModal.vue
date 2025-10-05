<script setup>
import { ref } from 'vue';
import { useAuth } from '../../stores/auth';

const emit = defineEmits(['close', 'switchToLogin', 'registerSuccess']);

const { register, loading } = useAuth();

const formData = ref({
  email: '',
  password: '',
  confirmPassword: '',
  username: '',
  fullName: '',
  agreeTerms: false,
});

const showPassword = ref(false);
const showConfirmPassword = ref(false);
const errorMessage = ref('');

async function handleSubmit() {
  errorMessage.value = '';
  
  // 驗證
  if (!formData.value.email) {
    errorMessage.value = '請輸入 Email';
    return;
  }
  
  if (!formData.value.password) {
    errorMessage.value = '請輸入密碼';
    return;
  }
  
  if (formData.value.password.length < 6) {
    errorMessage.value = '密碼至少需要 6 個字元';
    return;
  }
  
  if (formData.value.password !== formData.value.confirmPassword) {
    errorMessage.value = '密碼不一致';
    return;
  }
  
  if (!formData.value.agreeTerms) {
    errorMessage.value = '請同意服務條款';
    return;
  }
  
  const result = await register(
    formData.value.email,
    formData.value.password,
    formData.value.username,
    formData.value.fullName
  );
  
  if (result.success) {
    emit('registerSuccess');
    emit('close');
  } else {
    errorMessage.value = result.error;
  }
}

function handleSwitchToLogin() {
  emit('switchToLogin');
}
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="auth-modal auth-modal--large">
      <button class="modal-close" @click="$emit('close')">
        <i class="fas fa-times"></i>
      </button>
      
      <div class="auth-modal-content">
        <div class="auth-header">
          <div class="auth-icon">
            <i class="fas fa-rocket"></i>
          </div>
          <h2>加入 QuantGem</h2>
          <p>開始您的智能投資之旅</p>
        </div>
        
        <form @submit.prevent="handleSubmit" class="auth-form">
          <div v-if="errorMessage" class="alert alert--error">
            <i class="fas fa-exclamation-circle"></i>
            {{ errorMessage }}
          </div>
          
          <div class="form-row">
            <div class="form-field">
              <label>Email *</label>
              <div class="input-wrapper">
                <i class="fas fa-envelope"></i>
                <input
                  v-model="formData.email"
                  type="email"
                  placeholder="your@email.com"
                  required
                  autocomplete="email"
                />
              </div>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-field">
              <label>用戶名稱</label>
              <div class="input-wrapper">
                <i class="fas fa-user"></i>
                <input
                  v-model="formData.username"
                  type="text"
                  placeholder="選填"
                  autocomplete="username"
                />
              </div>
            </div>
            
            <div class="form-field">
              <label>姓名</label>
              <div class="input-wrapper">
                <i class="fas fa-id-card"></i>
                <input
                  v-model="formData.fullName"
                  type="text"
                  placeholder="選填"
                  autocomplete="name"
                />
              </div>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-field">
              <label>密碼 *</label>
              <div class="input-wrapper">
                <i class="fas fa-lock"></i>
                <input
                  v-model="formData.password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="至少 6 個字元"
                  required
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="toggle-password"
                  @click="showPassword = !showPassword"
                >
                  <i class="fas" :class="showPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
                </button>
              </div>
            </div>
            
            <div class="form-field">
              <label>確認密碼 *</label>
              <div class="input-wrapper">
                <i class="fas fa-lock"></i>
                <input
                  v-model="formData.confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  placeholder="再次輸入密碼"
                  required
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="toggle-password"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <i class="fas" :class="showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
                </button>
              </div>
            </div>
          </div>
          
          <div class="form-field-checkbox">
            <label>
              <input
                v-model="formData.agreeTerms"
                type="checkbox"
                required
              />
              <span>我同意 <a href="#" class="link">服務條款</a> 和 <a href="#" class="link">隱私政策</a></span>
            </label>
          </div>
          
          <button type="submit" class="btn-auth" :disabled="loading">
            <span v-if="loading">
              <i class="fas fa-spinner fa-spin"></i> 註冊中...
            </span>
            <span v-else>
              <i class="fas fa-user-plus"></i> 註冊帳號
            </span>
          </button>
        </form>
        
        <div class="auth-footer">
          <p>
            已經有帳號了？
            <button class="link-button" @click="handleSwitchToLogin">
              立即登入
            </button>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
