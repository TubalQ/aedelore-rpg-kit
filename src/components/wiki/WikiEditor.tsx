"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { useT } from "@/lib/i18n";
import { editorHtml, editorKeepsPage } from "@/lib/wiki/round-trip";
import { isInSpoiler, wikiExtensions } from "./wiki-extensions";

interface WikiEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const TOOLBAR_BTN =
  "px-2 py-1 rounded text-sm font-medium transition-colors text-text-muted hover:text-text-base hover:bg-bg-elevated";
const TOOLBAR_BTN_ACTIVE = "bg-accent-gold/20 text-accent-gold";

function ToolbarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`${TOOLBAR_BTN} ${active ? TOOLBAR_BTN_ACTIVE : ""}`}
    >
      {label}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-border mx-1" />;
}

export default function WikiEditor({
  content,
  onChange,
  placeholder = "Begin writing...",
}: WikiEditorProps) {
  const { t } = useT();
  // A page the editor cannot keep as it is opens read-only: editing it would
  // rewrite it without the formatting the editor does not know (W1). Checked
  // once, on the page as loaded; the editor exists only in the browser.
  const [keepsPage] = useState(() => typeof window === "undefined" || editorKeepsPage(content));
  const editor = useEditor({
    extensions: wikiExtensions(placeholder),
    content,
    editable: keepsPage,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      if (keepsPage) onChange(editorHtml(ed));
    },
    editorProps: {
      attributes: {
        class: "wiki-content prose prose-invert prose-sm max-w-none outline-none min-h-[400px] p-4",
      },
    },
  });

  if (!editor) return null;

  function addLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href ?? "";
    const url = window.prompt("URL", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }

  function addImage() {
    if (!editor) return;
    const url = window.prompt("Image URL");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }

  if (!keepsPage) {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <p role="status" className="px-4 py-3 text-sm bg-bg-surface border-b border-border text-accent-red">
          {t("wikiAdmin.editorCannotKeep")}
        </p>
        <div className="bg-bg-base">
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-bg-surface border-b border-border">
        <ToolbarButton
          label="B"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="I"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="U"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />

        <Separator />

        <ToolbarButton
          label="H2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          label="H3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <ToolbarButton
          label="H4"
          active={editor.isActive("heading", { level: 4 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 4 }).run()
          }
        />

        <Separator />

        <ToolbarButton
          label="&bull; List"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="1. List"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="&#8220; Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />

        <Separator />

        <ToolbarButton
          label="Link"
          active={editor.isActive("link")}
          onClick={addLink}
        />
        <ToolbarButton label="Image" onClick={addImage} />
        <ToolbarButton
          label="&#8212;"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />

        <Separator />

        <ToolbarButton
          label="Spoiler"
          active={isInSpoiler(editor.state.selection.$from)}
          onClick={() => editor.chain().focus().toggleSpoiler().run()}
        />
      </div>

      <div className="bg-bg-base">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
