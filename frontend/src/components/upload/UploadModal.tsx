'use client'

import { useState, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { 
  X, 
  Upload, 
  FileText, 
  Globe, 
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete?: (uploadId: string) => void
}

type ContentType = 'pdf' | 'article' | 'url'
type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

interface UploadData {
  type: ContentType
  file?: File
  url?: string
  title?: string
  metadata: {
    difficulty: 'easy' | 'medium' | 'hard'
    category: string
    customInstructions?: string
  }
}

export default function UploadModal({ isOpen, onClose, onUploadComplete }: UploadModalProps) {
  const { token } = useAuthStore()
  const [selectedType, setSelectedType] = useState<ContentType>('pdf')
  const [uploadData, setUploadData] = useState<UploadData>({
    type: 'pdf',
    metadata: {
      difficulty: 'medium',
      category: 'general'
    }
  })
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  if (!isOpen) return null

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      if (selectedType === 'pdf' && file.type !== 'application/pdf') {
        setErrorMessage('Please select a PDF file')
        return
      }
      
      setUploadData(prev => ({
        ...prev,
        file,
        title: file.name.replace(/\.[^/.]+$/, '') // Remove extension
      }))
      setErrorMessage('')
    }
  }

  const handleUrlChange = (url: string) => {
    setUploadData(prev => ({
      ...prev,
      url,
      title: prev.title || extractTitleFromUrl(url)
    }))
  }

  const extractTitleFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname + urlObj.pathname
    } catch {
      return url
    }
  }

  const handleUpload = async () => {
    if (!uploadData.file && !uploadData.url) {
      setErrorMessage('Please select a file or enter a URL')
      return
    }

    setUploadStatus('uploading')
    setUploadProgress(0)
    setErrorMessage('')

    try {
      const formData = new FormData()
      
      // Add basic data
      formData.append('type', uploadData.type)
      formData.append('title', uploadData.title || '')
      formData.append('difficulty', uploadData.metadata.difficulty)
      formData.append('category', uploadData.metadata.category)
      
      if (uploadData.metadata.customInstructions) {
        formData.append('customInstructions', uploadData.metadata.customInstructions)
      }

      // Add file or URL
      if (uploadData.file) {
        formData.append('file', uploadData.file)
      } else if (uploadData.url) {
        formData.append('url', uploadData.url)
      }

      setUploadProgress(25)
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/content`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(errorData.error || `Upload failed with status ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success || !result.data?.id) {
        throw new Error('Upload failed - no upload ID returned')
      }

      setUploadProgress(100)
      setUploadStatus('success')
      
      // Call completion callback immediately after successful upload
      if (onUploadComplete) {
        onUploadComplete(result.data.id)
      }
      
      // Show success message and close modal
      setTimeout(() => {
        handleClose()
      }, 1500) // Short delay to show success

    } catch (error) {
      setUploadStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed')
    }
  }


  const handleClose = () => {
    if (uploadStatus === 'uploading') {
      return // Don't allow closing during upload
    }
    
    // Clear any polling timeouts
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
    
    // Reset state
    setSelectedType('pdf')
    setUploadData({
      type: 'pdf',
      metadata: {
        difficulty: 'medium',
        category: 'general'
      }
    })
    setUploadStatus('idle')
    setUploadProgress(0)
    setErrorMessage('')
    
    onClose()
  }

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      default:
        return <Upload className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusText = () => {
    switch (uploadStatus) {
      case 'uploading':
        return 'Uploading...'
      case 'processing':
        return 'Processing content...'
      case 'success':
        return 'Uploaded! Processing in background...'
      case 'error':
        return 'Upload failed'
      default:
        return 'Upload Content'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Upload Learning Content</h2>
          <button
            onClick={handleClose}
            disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Content Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Content Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedType('pdf')}
                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-colors ${
                  selectedType === 'pdf'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <FileText className="w-8 h-8 mb-2" />
                <span className="font-medium">PDF</span>
                <span className="text-xs text-gray-600">Upload PDF file</span>
              </button>
              
              <button
                onClick={() => setSelectedType('article')}
                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-colors ${
                  selectedType === 'article'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <FileText className="w-8 h-8 mb-2" />
                <span className="font-medium">Article</span>
                <span className="text-xs text-gray-600">Text content</span>
              </button>
              
              <button
                onClick={() => setSelectedType('url')}
                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-colors ${
                  selectedType === 'url'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <Globe className="w-8 h-8 mb-2" />
                <span className="font-medium">URL</span>
                <span className="text-xs text-gray-600">Web article</span>
              </button>
            </div>
          </div>

          {/* File Upload or URL Input */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {selectedType === 'url' ? 'Article URL' : 'File'}
            </label>
            
            {selectedType === 'url' ? (
              <input
                type="url"
                placeholder="https://example.com/article"
                value={uploadData.url || ''}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={selectedType === 'pdf' ? '.pdf' : '*'}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center px-4 py-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">
                      {uploadData.file ? uploadData.file.name : 'Click to select file'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedType === 'pdf' ? 'PDF files only' : 'Any document file'}
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Title (Optional)
            </label>
            <input
              type="text"
              placeholder="Enter a custom title..."
              value={uploadData.title || ''}
              onChange={(e) => setUploadData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Difficulty
              </label>
              <select
                value={uploadData.metadata.difficulty}
                onChange={(e) => setUploadData(prev => ({
                  ...prev,
                  metadata: { ...prev.metadata, difficulty: e.target.value as any }
                }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Category
              </label>
              <select
                value={uploadData.metadata.category}
                onChange={(e) => setUploadData(prev => ({
                  ...prev,
                  metadata: { ...prev.metadata, category: e.target.value }
                }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="general">General</option>
                <option value="technology">Technology</option>
                <option value="business">Business</option>
                <option value="science">Science</option>
                <option value="personal-development">Personal Development</option>
                <option value="health">Health</option>
                <option value="history">History</option>
                <option value="philosophy">Philosophy</option>
              </select>
            </div>
          </div>

          {/* Custom Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Custom Instructions (Optional)
            </label>
            <textarea
              placeholder="Any specific instructions for content processing..."
              value={uploadData.metadata.customInstructions || ''}
              onChange={(e) => setUploadData(prev => ({
                ...prev,
                metadata: { ...prev.metadata, customInstructions: e.target.value }
              }))}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{errorMessage}</span>
            </div>
          )}

          {/* Upload Progress */}
          {uploadStatus !== 'idle' && (
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                {getStatusIcon()}
                <span className="text-sm font-medium">{getStatusText()}</span>
              </div>
              
              {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={handleClose}
            disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploadStatus === 'uploading' || uploadStatus === 'processing' || uploadStatus === 'success'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {getStatusIcon()}
            <span>{getStatusText()}</span>
          </button>
        </div>
      </div>
    </div>
  )
}