const appUrl = process.env.APP_URL ?? "";

function taskLink(taskId: number, taskTitle: string): string {
  if (!appUrl) return `<strong>${taskTitle}</strong>`;
  return `<a href="${appUrl}/requirements/${taskId}" style="color:#4f46e5">${taskTitle}</a>`;
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;background:#f4f4f5;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e4e4e7">
    <h2 style="margin:0 0 16px;color:#18181b">${title}</h2>
    ${body}
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
    <p style="font-size:12px;color:#71717a;margin:0">Dev Tracker — automated notification</p>
  </div>
</body>
</html>`;
}

export function taskAssignedTemplate(opts: {
  taskId: number;
  taskTitle: string;
  assignerName: string;
  priority: string;
  projectName: string;
}): string {
  return layout(
    "You have been assigned a task",
    `<p style="color:#3f3f46;margin:0 0 12px">
      <strong>${opts.assignerName}</strong> assigned the following task to you:
    </p>
    <div style="background:#f4f4f5;border-radius:6px;padding:16px;margin-bottom:16px">
      <p style="margin:0 0 8px;font-size:16px">${taskLink(opts.taskId, opts.taskTitle)}</p>
      <p style="margin:0;font-size:13px;color:#71717a">
        Project: <strong>${opts.projectName}</strong> &nbsp;|&nbsp;
        Priority: <strong>${opts.priority}</strong>
      </p>
    </div>
    <p style="color:#71717a;font-size:13px;margin:0">Please log in to Dev Tracker to review the task details.</p>`,
  );
}

export function testerAssignedTemplate(opts: {
  taskId: number;
  taskTitle: string;
  assignerName: string;
  priority: string;
  projectName: string;
}): string {
  return layout(
    "You have been assigned as a tester",
    `<p style="color:#3f3f46;margin:0 0 12px">
      <strong>${opts.assignerName}</strong> assigned you as a QA tester on the following task:
    </p>
    <div style="background:#f4f4f5;border-radius:6px;padding:16px;margin-bottom:16px">
      <p style="margin:0 0 8px;font-size:16px">${taskLink(opts.taskId, opts.taskTitle)}</p>
      <p style="margin:0;font-size:13px;color:#71717a">
        Project: <strong>${opts.projectName}</strong> &nbsp;|&nbsp;
        Priority: <strong>${opts.priority}</strong>
      </p>
    </div>
    <p style="color:#71717a;font-size:13px;margin:0">Please log in to Dev Tracker to review the task details.</p>`,
  );
}

export function adminAlertTemplate(opts: {
  taskId: number;
  taskTitle: string;
  adminName: string;
  projectName: string;
  message?: string;
}): string {
  return layout(
    "Alert from admin",
    `<p style="color:#3f3f46;margin:0 0 12px">
      <strong>${opts.adminName}</strong> sent you an alert regarding the following task:
    </p>
    <div style="background:#f4f4f5;border-radius:6px;padding:16px;margin-bottom:16px">
      <p style="margin:0 0 8px;font-size:16px">${taskLink(opts.taskId, opts.taskTitle)}</p>
      <p style="margin:0;font-size:13px;color:#71717a">Project: <strong>${opts.projectName}</strong></p>
      ${opts.message ? `<p style="margin:12px 0 0;font-size:13px;color:#3f3f46;border-top:1px solid #e4e4e7;padding-top:10px">${opts.message}</p>` : ""}
    </div>
    <p style="color:#71717a;font-size:13px;margin:0">Please log in to Dev Tracker to view the task details.</p>`,
  );
}

export function statusTransitionTemplate(opts: {
  taskId: number;
  taskTitle: string;
  actorName: string;
  fromStatus: string;
  toStatus: string;
  projectName: string;
  note?: string | null;
}): string {
  const statusLabel = (s: string) => s.replace(/_/g, " ");
  return layout(
    "Task status updated",
    `<p style="color:#3f3f46;margin:0 0 12px">
      <strong>${opts.actorName}</strong> updated the status of a task you are involved in:
    </p>
    <div style="background:#f4f4f5;border-radius:6px;padding:16px;margin-bottom:16px">
      <p style="margin:0 0 8px;font-size:16px">${taskLink(opts.taskId, opts.taskTitle)}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#71717a">
        Project: <strong>${opts.projectName}</strong>
      </p>
      <p style="margin:0;font-size:13px;color:#71717a">
        Status: <strong>${statusLabel(opts.fromStatus)}</strong>
        &nbsp;→&nbsp;
        <strong style="color:#4f46e5">${statusLabel(opts.toStatus)}</strong>
      </p>
      ${opts.note ? `<p style="margin:12px 0 0;font-size:13px;color:#3f3f46;border-top:1px solid #e4e4e7;padding-top:10px">Note: ${opts.note}</p>` : ""}
    </div>
    <p style="color:#71717a;font-size:13px;margin:0">Please log in to Dev Tracker to view the full activity log.</p>`,
  );
}
