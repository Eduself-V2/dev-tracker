import { Router, type IRouter } from "express";
import multer from "multer";
import { uploadToS3, deleteFromS3 } from "../../lib/s3";
import { trackerPool, type AttachmentRow } from "../../lib/trackerDb";

const router: IRouter = Router({ mergeParams: true } as any);

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: images, PDF, Excel, CSV`));
    }
  },
});

function serializeAttachment(a: AttachmentRow) {
  return {
    id: a.id,
    requirementId: a.requirement_id,
    commentId: a.comment_id,
    s3Url: a.s3_url,
    originalName: a.original_name,
    mimeType: a.mime_type,
    sizeBytes: a.size_bytes,
    uploadedBy: a.uploaded_by,
    uploaderName: a.uploader_name,
    createdAt: a.created_at.toISOString(),
  };
}

// POST /tracker/requirements/:id/attachments
// Accepts multipart/form-data with field "files" (up to 5) and optional "commentId"
router.post("/", upload.array("files", 5), async (req, res, next) => {
  try {
    const reqId = parseInt(String(req.params["id"]));
    if (isNaN(reqId)) {
      res.status(400).json({ error: "Invalid requirement ID" });
      return;
    }

    const commentId = req.body.commentId ? parseInt(String(req.body.commentId)) : null;
    const me = req.trackerUser!;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files provided" });
      return;
    }

    const [reqRows] = await trackerPool.query(
      "SELECT id FROM requirements WHERE id = ?",
      [reqId],
    );
    if ((reqRows as Array<{ id: number }>).length === 0) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }

    if (commentId !== null) {
      const [cmtRows] = await trackerPool.query(
        "SELECT id FROM requirement_comments WHERE id = ? AND requirement_id = ?",
        [commentId, reqId],
      );
      if ((cmtRows as Array<{ id: number }>).length === 0) {
        res.status(404).json({ error: "Comment not found" });
        return;
      }
    }

    const results = [];
    for (const file of files) {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `requirements/${reqId}/${timestamp}-${safeName}`;
      const url = await uploadToS3(key, file.buffer, file.mimetype);

      const [result] = await trackerPool.query(
        `INSERT INTO requirement_attachments
         (requirement_id, comment_id, s3_key, s3_url, original_name, mime_type, size_bytes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [reqId, commentId, key, url, file.originalname, file.mimetype, file.size, me.id],
      );
      const insertId = (result as { insertId: number }).insertId;
      const [rows] = await trackerPool.query(
        `SELECT a.*, u.name AS uploader_name FROM requirement_attachments a
         JOIN users u ON u.id = a.uploaded_by WHERE a.id = ?`,
        [insertId],
      );
      results.push(serializeAttachment((rows as AttachmentRow[])[0]));
    }

    res.status(201).json(results);
  } catch (err) {
    next(err);
  }
});

// DELETE /tracker/requirements/:id/attachments/:attachmentId
router.delete("/:attachmentId", async (req, res, next) => {
  try {
    const reqId = parseInt(String(req.params["id"]));
    const attachmentId = parseInt(String(req.params["attachmentId"]));
    const me = req.trackerUser!;

    if (isNaN(reqId) || isNaN(attachmentId)) {
      res.status(400).json({ error: "Invalid IDs" });
      return;
    }

    const [rows] = await trackerPool.query(
      "SELECT * FROM requirement_attachments WHERE id = ? AND requirement_id = ?",
      [attachmentId, reqId],
    );
    const attachment = (rows as AttachmentRow[])[0];
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    if (me.role !== "admin" && attachment.uploaded_by !== me.id) {
      res.status(403).json({ error: "You can only delete your own attachments" });
      return;
    }

    await deleteFromS3(attachment.s3_key);
    await trackerPool.query("DELETE FROM requirement_attachments WHERE id = ?", [attachmentId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
