package com.remotecontrol.client.ui

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.documentfile.provider.DocumentFile
import com.remotecontrol.client.databinding.ActivitySettingsBinding
import com.remotecontrol.client.utils.PermissionUtils
import com.remotecontrol.client.utils.PreferenceManager

class SettingsActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivitySettingsBinding
    
    private val storagePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (Environment.isExternalStorageManager()) {
                Toast.makeText(this, "存储权限已授予", Toast.LENGTH_SHORT).show()
                updatePermissionStatus()
            } else {
                Toast.makeText(this, "存储权限被拒绝", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private val directoryPickerLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocumentTree()
    ) { uri ->
        uri?.let {
            contentResolver.takePersistableUriPermission(
                it,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
            PreferenceManager.saveStorageUri(this, it.toString())
            binding.textStoragePath.text = "存储路径: ${getDisplayPath(it)}"
            Toast.makeText(this, "存储路径已设置", Toast.LENGTH_SHORT).show()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupViews()
        setupClickListeners()
        updatePermissionStatus()
    }
    
    private fun setupViews() {
        // 设置当前服务器地址
        val serverUrl = PreferenceManager.getServerUrl(this)
        binding.editServerUrl.setText(serverUrl)
        
        // 设置隐蔽模式状态
        binding.switchStealthMode.isChecked = PreferenceManager.isStealthMode(this)
        
        // 设置存储路径
        val storageUri = PreferenceManager.getStorageUri(this)
        if (storageUri.isNotEmpty()) {
            binding.textStoragePath.text = "存储路径: ${getDisplayPath(Uri.parse(storageUri))}"
        } else {
            binding.textStoragePath.text = "存储路径: 未设置"
        }
    }
    
    private fun setupClickListeners() {
        binding.buttonSaveServer.setOnClickListener {
            val url = binding.editServerUrl.text.toString().trim()
            if (url.isNotEmpty()) {
                PreferenceManager.saveServerUrl(this, url)
                Toast.makeText(this, "服务器地址已保存", Toast.LENGTH_SHORT).show()
            }
        }
        
        binding.switchStealthMode.setOnCheckedChangeListener { _, isChecked ->
            PreferenceManager.setStealthMode(this, isChecked)
            Toast.makeText(this, if (isChecked) "隐蔽模式已启用" else "隐蔽模式已关闭", Toast.LENGTH_SHORT).show()
        }
        
        binding.buttonRequestPermissions.setOnClickListener {
            requestAllPermissions()
        }
        
        binding.buttonSelectStorage.setOnClickListener {
            selectStorageLocation()
        }
        
        binding.buttonBack.setOnClickListener {
            finish()
        }
    }
    
    private fun updatePermissionStatus() {
        val hasCamera = PermissionUtils.hasCameraPermission(this)
        val hasAudio = PermissionUtils.hasAudioPermission(this)
        val hasStorage = PreferenceManager.hasStoragePermission(this)
        
        binding.textCameraPermission.text = "相机权限: ${if (hasCamera) "已授予" else "未授予"}"
        binding.textAudioPermission.text = "录音权限: ${if (hasAudio) "已授予" else "未授予"}"
        binding.textStoragePermission.text = "存储权限: ${if (hasStorage) "已授予" else "未授予"}"
        
        val allGranted = hasCamera && hasAudio && hasStorage
        binding.textPermissionStatus.text = if (allGranted) "所有权限已授予" else "部分权限未授予"
    }
    
    private fun requestAllPermissions() {
        if (!PermissionUtils.hasAllPermissions(this)) {
            PermissionUtils.requestPermissions(this)
        }
        
        // 请求存储权限
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                intent.data = Uri.parse("package:$packageName")
                storagePermissionLauncher.launch(intent)
            }
        }
    }
    
    private fun selectStorageLocation() {
        directoryPickerLauncher.launch(null)
    }
    
    private fun getDisplayPath(uri: Uri): String {
        val documentFile = DocumentFile.fromTreeUri(this, uri)
        return documentFile?.name ?: uri.toString()
    }
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        updatePermissionStatus()
    }
}