<?php

declare(strict_types=1);

namespace OrbitApi\Controllers;

use OrbitApi\Repositories\ContentRepository;
use OrbitApi\Response;

final class MediaController
{
    public function __construct(
        private ContentRepository $repo,
        private array $config
    ) {
    }

    public function upload(): void
    {
        $siteId = (string) ($_POST['siteId'] ?? $this->config['default_site_id']);
        if (!$this->repo->siteExists($siteId)) {
            Response::error('Site not found', 404);
            return;
        }

        if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
            Response::error('Missing multipart field: file', 422);
            return;
        }

        $file = $_FILES['file'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Response::error('Upload failed (error code ' . (int) $file['error'] . ')', 400);
            return;
        }

        $max = (int) ($this->config['max_upload_bytes'] ?? 20971520);
        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0 || $size > $max) {
            Response::error('File too large or empty', 413);
            return;
        }

        $original = (string) ($file['name'] ?? 'upload.bin');
        $tmp = (string) $file['tmp_name'];
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($tmp) ?: 'application/octet-stream';

        $kind = 'other';
        if (str_starts_with($mime, 'image/')) {
            $kind = 'image';
        } elseif (str_starts_with($mime, 'video/')) {
            $kind = 'video';
        }

        $allowed = [
            'image/jpeg', 'image/png', 'image/webp', 'image/gif',
            'video/mp4', 'video/webm', 'video/quicktime',
        ];
        if (!in_array($mime, $allowed, true)) {
            Response::error('Unsupported mime type: ' . $mime, 415);
            return;
        }

        $ext = pathinfo($original, PATHINFO_EXTENSION);
        $ext = $ext !== '' ? preg_replace('/[^a-zA-Z0-9]/', '', $ext) : ($kind === 'image' ? 'jpg' : 'bin');
        $id = orbit_new_id('media');
        $relativeName = $id . '.' . strtolower((string) $ext);

        $uploadsDir = $this->config['uploads_dir'];
        if (!is_dir($uploadsDir) && !mkdir($uploadsDir, 0755, true) && !is_dir($uploadsDir)) {
            Response::error('Uploads directory not writable', 500);
            return;
        }

        $diskPath = rtrim($uploadsDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $relativeName;
        if (!move_uploaded_file($tmp, $diskPath)) {
            Response::error('Could not store uploaded file', 500);
            return;
        }

        $publicUrl = rtrim((string) $this->config['public_base_url'], '/')
            . rtrim((string) $this->config['uploads_url_path'], '/')
            . '/' . $relativeName;

        try {
            $media = $this->repo->insertMedia([
                'id' => $id,
                'site_id' => $siteId,
                'disk_path' => $diskPath,
                'public_url' => $publicUrl,
                'mime' => $mime,
                'bytes' => $size,
                'original_name' => $original,
                'kind' => $kind,
            ]);
            Response::json($media, 201);
        } catch (\Throwable $e) {
            @unlink($diskPath);
            Response::error('Failed to save media row: ' . $e->getMessage(), 500);
        }
    }
}
