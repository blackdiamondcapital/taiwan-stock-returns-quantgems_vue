<script setup>
import { ref } from 'vue';
import { useAuth } from '../../stores/auth';

const emit = defineEmits(['close', 'switchToRegister', 'loginSuccess']);

const { login, loading, error: authError } = useAuth();

const formData = ref({
  email: '',
  password: '',
});

const showPassword = ref(false);
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
  
  const result = await login(formData.value.email, formData.value.password);
  
  if (result.success) {
    emit('loginSuccess');
    emit('close');
  } else {
    errorMessage.value = result.error;
  }
}

function handleSwitchToRegister() {
  emit('switchToRegister');
}
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="auth-modal">
      <button class="modal-close" @click="$emit('close')">
        <i class="fas fa-times"></i>
      </button>
      
      <div class="auth-modal-content">
        <div class="auth-header">
          <div class="auth-icon">
            <i class="fas fa-chart-line"></i>
          </div>
          <h2>登入 QuantGem</h2>
          <p>歡迎回來！繼續追蹤您的投資組合</p>
        </div>
        
        <form @submit.prevent="handleSubmit" class="auth-form">
          <div v-if="errorMessage" class="alert alert--error">
            <i class="fas fa-exclamation-circle"></i>
            {{ errorMessage }}
          </div>
          
          <div class="form-field">
            <label>Email</label>
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
          
          <div class="form-field">
            <label>密碼</label>
            <div class="input-wrapper">
              <i class="fas fa-lock"></i>
              <input
                v-model="formData.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="請輸入密碼"
                required
                autocomplete="current-password"
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
          
          <button type="submit" class="btn-auth" :disabled="loading">
            <span v-if="loading">
              <i class="fas fa-spinner fa-spin"></i> 登入中...
            </span>
            <span v-else>
              <i class="fas fa-sign-in-alt"></i> 登入
            </span>
          </button>
        </form>
        
        <div class="auth-footer">
          <p>
            還沒有帳號？
            <button class="link-button" @click="handleSwitchToRegister">
              立即註冊
            </button>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
