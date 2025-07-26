package com.remotecontrol.client.utils

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

object PermissionUtils {
    
    const val REQUEST_CODE_PERMISSIONS = 1001
    
    val REQUIRED_PERMISSIONS = arrayOf(
        Manifest.permission.CAMERA,
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
        Manifest.permission.READ_PHONE_STATE,
        Manifest.permission.WRITE_EXTERNAL_STORAGE,
        Manifest.permission.READ_EXTERNAL_STORAGE
    )
    
    fun hasAllPermissions(context: Context): Boolean {
        return REQUIRED_PERMISSIONS.all { permission ->
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        }
    }
    
    fun requestPermissions(activity: Activity) {
        ActivityCompat.requestPermissions(
            activity,
            REQUIRED_PERMISSIONS,
            REQUEST_CODE_PERMISSIONS
        )
    }
    
    fun hasPermission(context: Context, permission: String): Boolean {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }
    
    fun hasCameraPermission(context: Context): Boolean {
        return hasPermission(context, Manifest.permission.CAMERA)
    }
    
    fun hasAudioPermission(context: Context): Boolean {
        return hasPermission(context, Manifest.permission.RECORD_AUDIO)
    }
    
    fun hasLocationPermission(context: Context): Boolean {
        return hasPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) &&
                hasPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
    }
    
    fun hasStoragePermission(context: Context): Boolean {
        return hasPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) &&
                hasPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE)
    }
}