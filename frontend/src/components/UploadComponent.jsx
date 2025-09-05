import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { uploadFile, uploadFolder, scanFolderPath, cloneRepository } from '../services/api';

/**
 * Component for uploading ZIP files, folders, or providing repository URLs
 * @param {Object} props
 * @param {Function} props.onFileSelect - Callback when file is selected
 * @param {Function} props.onUrlSubmit - Callback when URL is submitted
 * @param {boolean} props.isLoading - Loading state
 * @returns {JSX.Element}
 */
function UploadComponent({ onFileSelect, onUrlSubmit, isLoading }) {
  const [uploadType, setUploadType] = useState('file'); // 'file', 'folder', 'direct-folder', or 'url'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [folderPath, setFolderPath] = useState('');
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  /**
   * Handle file drop for ZIP files
   */
  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    
    // Validate file type
    if (!file.name.endsWith('.zip')) {
      toast.error('Please upload a ZIP file');
      return;
    }
    
    // Validate file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File size must be less than 100MB');
      return;
    }
    
    try {
      setUploadProgress(0);
      toast.loading('Uploading file...');
      
      const response = await uploadFile(file, (progress) => {
        setUploadProgress(progress);
      });
      
      toast.dismiss();
      toast.success('File uploaded successfully!');
      onFileSelect(response);
    } catch (error) {
      toast.dismiss();
      toast.error(error.message || 'Failed to upload file');
    }
  }, [onFileSelect]);

  /**
   * Handle folder upload
   */
  const handleFolderUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      toast.error('No files selected');
      return;
    }

    console.log('Selected files:', files.length);
    console.log('First file:', files[0]?.name, files[0]?.webkitRelativePath);

    // No limits - allow any size and file count
    console.log(`Uploading ${files.length} files from folder`);
    const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
    console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    try {
      setUploadProgress(0);
      toast.loading('Uploading folder...');
      
      const response = await uploadFolder(files, (progress) => {
        setUploadProgress(progress);
      });
      
      toast.dismiss();
      toast.success(`Folder uploaded successfully! (${files.length} files)`);
      onFileSelect(response);
    } catch (error) {
      console.error('Folder upload error:', error);
      toast.dismiss();
      toast.error(error.message || 'Failed to upload folder');
    } finally {
      // Reset the file input
      event.target.value = '';
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  /**
   * Handle direct folder path submission
   */
  const onSubmitFolderPath = async (data) => {
    try {
      toast.loading('Setting up direct folder scan...');
      const response = await scanFolderPath(data.folderPath);
      
      toast.dismiss();
      toast.success('Folder ready for direct scanning (no files copied)!');
      onFileSelect(response);
      reset();
    } catch (error) {
      toast.dismiss();
      toast.error(error.message || 'Failed to setup folder scan');
    }
  };

  /**
   * Handle repository URL submission
   */
  const onSubmitUrl = async (data) => {
    try {
      toast.loading('Cloning repository...');
      const response = await cloneRepository(data.repositoryUrl);
      
      toast.dismiss();
      toast.success('Repository cloned successfully!');
      onUrlSubmit(response);
      reset();
    } catch (error) {
      toast.dismiss();
      toast.error(error.message || 'Failed to clone repository');
    }
  };

  return (
    <div className="card">
      {/* Upload type selector */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-lg border border-gray-200 p-1">
          <button
            type="button"
            onClick={() => setUploadType('file')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              uploadType === 'file'
                ? 'bg-primary-600 text-white'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Upload ZIP File
          </button>
          <button
            type="button"
            onClick={() => setUploadType('folder')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              uploadType === 'folder'
                ? 'bg-primary-600 text-white'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Upload Folder
          </button>
          <button
            type="button"
            onClick={() => setUploadType('direct-folder')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              uploadType === 'direct-folder'
                ? 'bg-primary-600 text-white'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Direct Folder Scan
          </button>
          <button
            type="button"
            onClick={() => setUploadType('url')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              uploadType === 'url'
                ? 'bg-primary-600 text-white'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Repository URL
          </button>
        </div>
      </div>

      {/* File upload */}
      {uploadType === 'file' && (
        <div>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />
            
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            
            {isDragActive ? (
              <p className="text-lg font-medium text-primary-600">
                Drop the ZIP file here
              </p>
            ) : (
              <>
                <p className="text-lg font-medium text-gray-900">
                  Drag and drop a ZIP file here
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  or click to select a file
                </p>
              </>
            )}
            
            <p className="mt-2 text-xs text-gray-400">
              ZIP files only, up to 100MB
            </p>
          </div>
          
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-4">
              <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary-600 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1 text-center">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* Folder upload */}
      {uploadType === 'folder' && (
        <div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderUpload}
              disabled={isLoading}
              className="hidden"
              id="folder-upload"
            />
            <label
              htmlFor="folder-upload"
              className={`cursor-pointer ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              
              <p className="text-lg font-medium text-gray-900">
                Click to select a folder
              </p>
              <p className="mt-1 text-sm text-gray-500">
                All files and subfolders will be included
              </p>
            </label>
            
            <p className="mt-2 text-xs text-red-500">
              Note: Files will be uploaded and copied to server temp directory
            </p>
            <p className="mt-1 text-xs text-gray-500">
              For large folders or direct scanning, use "Direct Folder Scan" option below
            </p>
          </div>
          
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-4">
              <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary-600 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1 text-center">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* Direct folder path input */}
      {uploadType === 'direct-folder' && (
        <form onSubmit={handleSubmit(onSubmitFolderPath)}>
          <div className="mb-4">
            <label htmlFor="folderPath" className="label">
              Folder Path (Absolute Path)
            </label>
            <input
              id="folderPath"
              type="text"
              className={`input ${errors.folderPath ? 'border-danger-500' : ''}`}
              placeholder="C:\Users\username\Documents\MyProject or /home/user/myproject"
              disabled={isLoading}
              {...register('folderPath', {
                required: 'Folder path is required',
                validate: (value) => {
                  // Basic validation for absolute paths
                  const isAbsolute = (value.startsWith('/') || /^[A-Za-z]:[/\\]/.test(value));
                  return isAbsolute || 'Please provide an absolute path';
                },
              })}
            />
            {errors.folderPath && (
              <p className="mt-1 text-sm text-danger-600">
                {errors.folderPath.message}
              </p>
            )}
            <p className="mt-2 text-xs text-green-600">
              ✅ Files will be scanned directly in their original location (NO copying)
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Best for large projects or when you want to scan without duplicating files
            </p>
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full"
          >
            {isLoading ? 'Processing...' : 'Setup Direct Folder Scan'}
          </button>
        </form>
      )}

      {/* URL input */}
      {uploadType === 'url' && (
        <form onSubmit={handleSubmit(onSubmitUrl)}>
          <div className="mb-4">
            <label htmlFor="repositoryUrl" className="label">
              Repository URL
            </label>
            <input
              id="repositoryUrl"
              type="url"
              className={`input ${errors.repositoryUrl ? 'border-danger-500' : ''}`}
              placeholder="https://github.com/username/repository"
              disabled={isLoading}
              {...register('repositoryUrl', {
                required: 'Repository URL is required',
                pattern: {
                  value: /^https?:\/\/.+/,
                  message: 'Please enter a valid URL',
                },
              })}
            />
            {errors.repositoryUrl && (
              <p className="mt-1 text-sm text-danger-600">
                {errors.repositoryUrl.message}
              </p>
            )}
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full"
          >
            {isLoading ? 'Processing...' : 'Clone Repository'}
          </button>
          
          <p className="mt-2 text-xs text-gray-500 text-center">
            Supports GitHub, GitLab, Bitbucket, and other Git repositories
          </p>
        </form>
      )}
    </div>
  );
}

export default UploadComponent;
