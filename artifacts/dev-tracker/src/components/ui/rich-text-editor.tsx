import * as React from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Strikethrough, List, ListOrdered, Heading1, Heading2, Heading3 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/toggle";

function isEditorContentEmpty(html: string) {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

function RichTextToolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) return null;
      return {
        bold: ctx.editor.isActive("bold"),
        italic: ctx.editor.isActive("italic"),
        strike: ctx.editor.isActive("strike"),
        bulletList: ctx.editor.isActive("bulletList"),
        orderedList: ctx.editor.isActive("orderedList"),
        heading1: ctx.editor.isActive("heading", { level: 1 }),
        heading2: ctx.editor.isActive("heading", { level: 2 }),
        heading3: ctx.editor.isActive("heading", { level: 3 }),
      };
    },
  });

  if (!editor || !state) return null;

  return (
    <div className="flex items-center gap-0.5 border-b border-border/60 px-1 py-1">
      <Toggle
        size="sm"
        pressed={state.heading1}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        aria-label="Heading 1"
        title="Heading 1"
      >
        <Heading1 className="w-3.5 h-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.heading2}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-label="Heading 2"
        title="Heading 2"
      >
        <Heading2 className="w-3.5 h-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.heading3}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        aria-label="Heading 3"
        title="Heading 3"
      >
        <Heading3 className="w-3.5 h-3.5" />
      </Toggle>
      <div className="w-px h-4 bg-border mx-1" />
      <Toggle
        size="sm"
        pressed={state.bold}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.italic}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.strike}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Strikethrough"
        title="Strikethrough"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </Toggle>
      <div className="w-px h-4 bg-border mx-1" />
      <Toggle
        size="sm"
        pressed={state.bulletList}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Bullet list"
        title="Bullet list"
      >
        <List className="w-3.5 h-3.5" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.orderedList}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Numbered list"
        title="Numbered list"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </Toggle>
    </div>
  );
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  autoFocus?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  contentClassName,
  autoFocus,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        code: false,
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer nofollow",
            class: "text-primary underline break-all",
          },
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    autofocus: autoFocus ?? false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:mt-2 prose-headings:mb-1",
          contentClassName,
        ),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  React.useEffect(() => {
    if (!editor) return;
    if (value === editor.getHTML()) return;
    if (isEditorContentEmpty(value) && editor.isEmpty) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring",
        className,
      )}
    >
      <RichTextToolbar editor={editor} />
      <EditorContent editor={editor} className="px-3 py-2" />
    </div>
  );
}

export { isEditorContentEmpty };
