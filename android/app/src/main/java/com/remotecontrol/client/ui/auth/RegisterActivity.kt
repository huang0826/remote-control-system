package com.remotecontrol.client.ui.auth

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.remotecontrol.client.RemoteControlApplication
import com.remotecontrol.client.data.model.RegisterRequest
import com.remotecontrol.client.databinding.ActivityRegisterBinding
import kotlinx.coroutines.launch

class RegisterActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityRegisterBinding
    private val app by lazy { application as RemoteControlApplication }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupClickListeners()
    }
    
    private fun setupClickListeners() {
        binding.buttonRegister.setOnClickListener {
            performRegister()
        }
        
        binding.textLogin.setOnClickListener {
            finish() // 返回登录界面
        }
    }
    
    private fun performRegister() {
        val phone = binding.editPhone.text.toString().trim()
        val nickname = binding.editNickname.text.toString().trim()
        val password = binding.editPassword.text.toString().trim()
        val confirmPassword = binding.editConfirmPassword.text.toString().trim()
        val agentCode = binding.editAgentCode.text.toString().trim()
        
        // 验证输入
        if (phone.isEmpty() || nickname.isEmpty() || password.isEmpty() || confirmPassword.isEmpty()) {
            Toast.makeText(this, "请填写必填信息", Toast.LENGTH_SHORT).show()
            return
        }
        
        // 验证手机号格式
        val phoneRegex = "^1[3-9]\\d{9}$"
        if (!phone.matches(phoneRegex.toRegex())) {
            Toast.makeText(this, "手机号格式不正确", Toast.LENGTH_SHORT).show()
            return
        }
        
        // 验证密码长度
        if (password.length < 6) {
            Toast.makeText(this, "密码长度不能少于6位", Toast.LENGTH_SHORT).show()
            return
        }
        
        // 验证两次密码是否一致
        if (password != confirmPassword) {
            Toast.makeText(this, "两次输入的密码不一致", Toast.LENGTH_SHORT).show()
            return
        }
        
        binding.buttonRegister.isEnabled = false
        binding.buttonRegister.text = "注册中..."
        
        lifecycleScope.launch {
            val request = RegisterRequest(phone, password, nickname, if (agentCode.isNotEmpty()) agentCode else null)
            val result = app.userRepository.register(request)
            
            result.onSuccess { userResponse ->
                Toast.makeText(this@RegisterActivity, "注册成功，请登录", Toast.LENGTH_SHORT).show()
                finish() // 返回登录界面
                
            }.onFailure { error ->
                Toast.makeText(this@RegisterActivity, "注册失败: ${error.message}", Toast.LENGTH_SHORT).show()
                binding.buttonRegister.isEnabled = true
                binding.buttonRegister.text = "注册"
            }
        }
    }
}