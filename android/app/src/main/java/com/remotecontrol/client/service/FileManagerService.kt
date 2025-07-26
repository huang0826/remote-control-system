package com.remotecontrol.client.service

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream

class FileManagerService(private val context: Context) {
    
    companion object {
        private const val TAG = "FileManagerService"
    }
    
    /**
     * 使用SAF获取文件列表
     */
    fun getFileListWithSAF(treeUri: Uri?, directoryUri: Uri? = null): JSONObject {
        val result = JSONObject()
        val fileList = JSONArray()
        
        try {
            if (treeUri == null) {
                result.put("success", false)
                result.put("message", "需要用户授权访问存储")
                result.put("need_permission", true)
                return result
            }
            
            val documentFile = if (directoryUri != null) {
                DocumentFile.fromTreeUri(context, directoryUri)
            } else {
                DocumentFile.fromTreeUri(context, treeUri)
            }
            
            if (documentFile == null || !documentFile.exists() || !documentFile.isDirectory) {
                result.put("success", false)
                result.put("message", "目录不存在或无法访问")
                return result
            }
            
            // 获取文件列表
            documentFile.listFiles().forEach { file ->
                val fileInfo = JSONObject()
                fileInfo.put("name", file.name ?: "未知")
                fileInfo.put("uri", file.uri.toString())
                fileInfo.put("is_directory", file.isDirectory)
                fileInfo.put("size", file.length())
                fileInfo.put("last_modified", file.lastModified())
                fileInfo.put("can_read", file.canRead())
                fileInfo.put("can_write", file.canWrite())
                
                // 获取MIME类型
                if (!file.isDirectory) {
                    val mimeType = context.contentResolver.getType(file.uri)
                    fileInfo.put("mime_type", mimeType ?: "application/octet-stream")
                }
                
                fileList.put(fileInfo)
            }
            
            result.put("success", true)
            result.put("path", documentFile.uri.toString())
            result.put("files", fileList)
            
        } catch (e: Exception) {
            Log.e(TAG, "获取文件列表失败", e)
            result.put("success", false)
            result.put("message", "获取文件列表失败: ${e.message}")
        }
        
        return result
    }
    
    /**
     * 读取文件内容（用于下载）
     */
    fun readFileContent(fileUri: Uri): ByteArray? {
        return try {
            context.contentResolver.openInputStream(fileUri)?.use { inputStream ->
                inputStream.readBytes()
            }
        } catch (e: Exception) {
            Log.e(TAG, "读取文件失败", e)
            null
        }
    }
    
    /**
     * 获取可访问的媒体文件（使用MediaStore）
     */
    fun getMediaFiles(mediaType: String): JSONObject {
        val result = JSONObject()
        val fileList = JSONArray()
        
        try {
            val uri = when (mediaType.lowercase()) {
                "image" -> android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                "video" -> android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                "audio" -> android.provider.MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
                else -> {
                    result.put("success", false)
                    result.put("message", "不支持的媒体类型")
                    return result
                }
            }
            
            val projection = arrayOf(
                android.provider.MediaStore.MediaColumns._ID,
                android.provider.MediaStore.MediaColumns.DISPLAY_NAME,
                android.provider.MediaStore.MediaColumns.SIZE,
                android.provider.MediaStore.MediaColumns.DATE_MODIFIED,
                android.provider.MediaStore.MediaColumns.DATA
            )
            
            context.contentResolver.query(
                uri,
                projection,
                null,
                null,
                "${android.provider.MediaStore.MediaColumns.DATE_MODIFIED} DESC"
            )?.use { cursor ->
                val idColumn = cursor.getColumnIndexOrThrow(android.provider.MediaStore.MediaColumns._ID)
                val nameColumn = cursor.getColumnIndexOrThrow(android.provider.MediaStore.MediaColumns.DISPLAY_NAME)
                val sizeColumn = cursor.getColumnIndexOrThrow(android.provider.MediaStore.MediaColumns.SIZE)
                val dateColumn = cursor.getColumnIndexOrThrow(android.provider.MediaStore.MediaColumns.DATE_MODIFIED)
                val dataColumn = cursor.getColumnIndexOrThrow(android.provider.MediaStore.MediaColumns.DATA)
                
                while (cursor.moveToNext()) {
                    val id = cursor.getLong(idColumn)
                    val name = cursor.getString(nameColumn)
                    val size = cursor.getLong(sizeColumn)
                    val dateModified = cursor.getLong(dateColumn) * 1000 // 转换为毫秒
                    val data = cursor.getString(dataColumn)
                    
                    val contentUri = Uri.withAppendedPath(uri, id.toString())
                    
                    val fileInfo = JSONObject()
                    fileInfo.put("name", name)
                    fileInfo.put("uri", contentUri.toString())
                    fileInfo.put("path", data)
                    fileInfo.put("is_directory", false)
                    fileInfo.put("size", size)
                    fileInfo.put("last_modified", dateModified)
                    fileInfo.put("media_type", mediaType)
                    
                    fileList.put(fileInfo)
                }
            }
            
            result.put("success", true)
            result.put("media_type", mediaType)
            result.put("files", fileList)
            
        } catch (e: Exception) {
            Log.e(TAG, "获取媒体文件失败", e)
            result.put("success", false)
            result.put("message", "获取媒体文件失败: ${e.message}")
        }
        
        return result
    }
}