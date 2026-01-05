// File and clipboard handling utilities
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import { app } from 'electron';

export async function processFileAttachment(taskId: string, filePath: string): Promise<string> {
  const userDataPath = app.getPath('userData');
  const attachmentsDir = join(userDataPath, 'taskvault', 'attachments', taskId);
  
  if (!existsSync(attachmentsDir)) {
    mkdirSync(attachmentsDir, { recursive: true });
  }

  const timestamp = Date.now();
  const originalName = basename(filePath);
  const ext = extname(originalName);
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const safeFileName = `${timestamp}_${sanitizedName}`;
  
  const destPath = join(attachmentsDir, safeFileName);
  
  // Copy file
  const { readFileSync } = await import('fs');
  const fileBuffer = readFileSync(filePath);
  writeFileSync(destPath, fileBuffer);

  // Return relative path: attachments/{taskId}/{filename}
  return `attachments/${taskId}/${safeFileName}`;
}

export async function processImagePaste(taskId: string, imageBuffer: Buffer): Promise<string> {
  const userDataPath = app.getPath('userData');
  const attachmentsDir = join(userDataPath, 'taskvault', 'attachments', taskId);
  
  if (!existsSync(attachmentsDir)) {
    mkdirSync(attachmentsDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `${timestamp}_paste.png`;
  const destPath = join(attachmentsDir, fileName);
  
  writeFileSync(destPath, imageBuffer);

  return `attachments/${taskId}/${fileName}`;
}

export function getAttachmentAbsolutePath(relativePath: string): string {
  const userDataPath = app.getPath('userData');
  return join(userDataPath, 'taskvault', relativePath);
}
