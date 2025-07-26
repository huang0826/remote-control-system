package com.remotecontrol.client.ui

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.remotecontrol.client.utils.PreferenceManager

class PermissionActivity : AppCompatActivity() {
    
    // SAF权限请求
    private val safPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocumentTree()
    ) { uri ->
        uri?.let {
            // 持久化权限
            contentResolver.takePersistableUriPermission(
                it,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
            
            // 保存授权URI
            PreferenceManager.saveStorageUri(this, it.toString())
            
            setResult(RESULT_OK)
            finish()
        } ?: run {
            setResult(RESULT_CANCELED)
            finish()
        }
    }
    
    // 管理外部存储权限请求（Android 11+）
    private val manageStoragePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (Environment.isExternalStorageManager()) {
                setResult(RESULT_OK)
            } else {
                setResult(RESULT_CANCELED)
            }
        }
        finish()
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val permissionType = intent.getStringExtra("permission_type") ?: "saf"
        
        when (permissionType) {
            "saf" -> requestSAFPermission()
            "manage_storage" -> requestManageStoragePermission()
            else -> {
                setResult(RESULT_CANCELED)
                finish()
            }
        }
    }
    
    private fun requestSAFPermission() {
        safPermissionLauncher.launch(null)
    }
    
    private fun requestManageStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                intent.data = Uri.parse("package:$packageName")
                manageStoragePermissionLauncher.launch(intent)
            } else {
                setResult(RESULT_OK)
                finish()
            }
        } else {
            setResult(RESULT_OK)
            finish()
        }
    }
    
    companion object {
        fun createSAFIntent(context: android.content.Context): Intent {
            return Intent(context, PermissionActivity::class.java).apply {
                putExtra("permission_type", "saf")
            }
        }
        
        fun createManageStorageIntent(context: android.content.Context): Intent {
            return Intent(context, PermissionActivity::class.java).apply {
                putExtra("permission_type", "manage_storage")
            }
        }
    }
}