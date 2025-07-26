package com.remotecontrol.client.utils

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.Environment

object PreferenceManager {
    private const val PREF_NAME = "remote_control_prefs"
    private const val KEY_TOKEN = "auth_token"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_IS_LOGGED_IN = "is_logged_in"
    private const val KEY_SERVER_URL = "server_url"
    private const val KEY_STEALTH_MODE = "stealth_mode"
    
    private fun getPreferences(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }
    
    fun saveToken(context: Context, token: String) {
        getPreferences(context).edit().putString(KEY_TOKEN, token).apply()
    }
    
    fun getToken(context: Context): String {
        return getPreferences(context).getString(KEY_TOKEN, "") ?: ""
    }
    
    fun saveDeviceId(context: Context, deviceId: String) {
        getPreferences(context).edit().putString(KEY_DEVICE_ID, deviceId).apply()
    }
    
    fun getDeviceId(context: Context): String {
        return getPreferences(context).getString(KEY_DEVICE_ID, "") ?: ""
    }
    
    fun saveUserId(context: Context, userId: Int) {
        getPreferences(context).edit().putInt(KEY_USER_ID, userId).apply()
    }
    
    fun getUserId(context: Context): Int {
        return getPreferences(context).getInt(KEY_USER_ID, -1)
    }
    
    fun setLoggedIn(context: Context, isLoggedIn: Boolean) {
        getPreferences(context).edit().putBoolean(KEY_IS_LOGGED_IN, isLoggedIn).apply()
    }
    
    fun isLoggedIn(context: Context): Boolean {
        return getPreferences(context).getBoolean(KEY_IS_LOGGED_IN, false)
    }
    
    fun saveServerUrl(context: Context, url: String) {
        getPreferences(context).edit().putString(KEY_SERVER_URL, url).apply()
    }
    
    fun getServerUrl(context: Context): String {
        return getPreferences(context)
            .getString(KEY_SERVER_URL, "http://114.215.211.109:3000") ?: "http://114.215.211.109:3000"
    }
    
    fun saveBoolean(context: Context, key: String, value: Boolean) {
        getPreferences(context).edit().putBoolean(key, value).apply()
    }
    
    fun getBoolean(context: Context, key: String, defaultValue: Boolean): Boolean {
        return getPreferences(context).getBoolean(key, defaultValue)
    }
    
    fun setStealthMode(context: Context, enabled: Boolean) {
        getPreferences(context).edit().putBoolean(KEY_STEALTH_MODE, enabled).apply()
    }
    
    fun isStealthMode(context: Context): Boolean {
        return getPreferences(context).getBoolean(KEY_STEALTH_MODE, true)
    }
    
    fun clearAll(context: Context) {
        getPreferences(context).edit().clear().apply()
    }
    
    fun saveStorageUri(context: Context, uri: String) {
        getPreferences(context).edit()
            .putString("storage_uri", uri)
            .apply()
    }
    
    fun getStorageUri(context: Context): String {
        return getPreferences(context).getString("storage_uri", "") ?: ""
    }
    
    fun hasStoragePermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            PermissionUtils.hasStoragePermission(context)
        }
    }
}