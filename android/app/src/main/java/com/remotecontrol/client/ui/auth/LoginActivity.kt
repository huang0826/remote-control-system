package com.remotecontrol.client.ui.auth

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.remotecontrol.client.RemoteControlApplication
import com.remotecontrol.client.data.model.LoginRequest
import com.remotecontrol.client.databinding.ActivityLoginBinding
import com.remotecontrol.client.ui.MainActivity
import com.remotecontrol.client.utils.PreferenceManager
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityLoginBinding
    private val app by lazy { application as RemoteControlApplication }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupClickListeners()
    }
    
    private fun setupClickListeners() {
        binding.buttonLogin.setOnClickListener {
            performLogin()
        }
        
        binding.textRegister.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }
    }
    
    private fun performLogin() {
        val phone = binding.editPhone.text.toString().trim()
        val password = binding.editPassword.text.toString().trim()
        
        if (phone.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "请填写手机号和密码", Toast.LENGTH_SHORT).show()
            return
        }
        
        binding.buttonLogin.isEnabled = false
        binding.buttonLogin.text = "登录中..."
        
        lifecycleScope.launch {
            val request = LoginRequest(phone, password)
            val result = app.userRepository.login(request)
            
            result.onSuccess { loginResponse ->
                // 保存登录信息
                PreferenceManager.saveToken(this@LoginActivity, loginResponse.token)
                PreferenceManager.saveUserId(this@LoginActivity, loginResponse.user.id)
                PreferenceManager.setLoggedIn(this@LoginActivity, true)
                
                Toast.makeText(this@LoginActivity, "登录成功", Toast.LENGTH_SHORT).show()
                
                // 跳转到主界面
                startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                finish()
                
            }.onFailure { error ->
                Toast.makeText(this@LoginActivity, "登录失败: ${error.message}", Toast.LENGTH_SHORT).show()
                binding.buttonLogin.isEnabled = true
                binding.buttonLogin.text = "登录"
            }
        }
    }
}