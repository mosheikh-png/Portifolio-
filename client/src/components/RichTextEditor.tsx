import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered, Pilcrow, Underline as UnderlineIcon } from "lucide-react";
import { useEffect } from "react";

type RichTextEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir: "rtl" | "ltr";
};

type ToolbarButtonProps = {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarButton({ label, active = false, onClick, children }: ToolbarButtonProps) {
  return <button type="button" aria-label={label} aria-pressed={active} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-lg border text-sm transition ${active ? "border-cyan-200/60 bg-cyan-300 text-[#042027]" : "border-white/10 bg-black/10 text-slate-200 hover:border-cyan-200/40 hover:bg-cyan-100/10"}`}>{children}</button>;
}

export default function RichTextEditor({ label, value, onChange, dir }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), TextAlign.configure({ types: ["heading", "paragraph"] })],
    content: value,
    editorProps: { attributes: { class: "rich-text-editor-content", dir } },
    onUpdate: ({ editor: updatedEditor }) => onChange(updatedEditor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  return <div className="block text-sm font-medium text-slate-300"><span>{label}</span><div className="mt-2 overflow-hidden rounded-xl border border-cyan-100/15 bg-[#071c21] focus-within:border-cyan-300/60 focus-within:ring-2 focus-within:ring-cyan-300/15"><div className="flex flex-wrap gap-1 border-b border-white/10 bg-black/10 p-2" dir="ltr"><ToolbarButton label="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={15} /></ToolbarButton><ToolbarButton label="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolbarButton><ToolbarButton label="Underline" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolbarButton><ToolbarButton label="Bullet list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={15} /></ToolbarButton><ToolbarButton label="Numbered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolbarButton><ToolbarButton label="Align right" active={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()}><AlignRight size={15} /></ToolbarButton><ToolbarButton label="Align center" active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()}><AlignCenter size={15} /></ToolbarButton><ToolbarButton label="Align left" active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()}><AlignLeft size={15} /></ToolbarButton><ToolbarButton label="Paragraph" active={editor?.isActive("paragraph")} onClick={() => editor?.chain().focus().setParagraph().run()}><Pilcrow size={15} /></ToolbarButton></div><EditorContent editor={editor} /></div></div>;
}
