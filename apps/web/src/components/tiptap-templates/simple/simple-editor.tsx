"use client"

import { useEffect, useRef, useState } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import MarkdownIt from "markdown-it"
import TurndownService from "turndown"
import { Code, Eye } from "lucide-react"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Selection } from "@tiptap/extensions"

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/tiptap-ui-primitive/dropdown-menu"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

// --- Hooks ---
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useWindowSize } from "@/hooks/use-window-size"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"

// --- Components ---
// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss"

interface SimpleEditorProps {
  content: string
  onChange: (value: string) => void
  editable?: boolean
  mode?: "edit" | "preview"
  onModeToggle?: () => void
}

const markdownInput = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
})

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
  bulletListMarker: "-",
})

function ModeToggleButton({
  mode,
  onToggle,
}: {
  mode: "edit" | "preview"
  onToggle?: () => void
}) {
  if (!onToggle) return null

  return (
    <ToolbarGroup>
      <Button variant="ghost" onClick={onToggle}>
        {mode === "edit" ? (
          <Eye className="tiptap-button-icon" />
        ) : (
          <Code className="tiptap-button-icon" />
        )}
        {mode === "edit" ? "Preview" : "Edit"}
      </Button>
    </ToolbarGroup>
  )
}

function CompactToolbarMenu({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          role="button"
          tabIndex={-1}
          aria-label={label}
          tooltip={label}
        >
          <span className="tiptap-button-text">{label}</span>
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>{children}</DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
  mode,
  onModeToggle,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
  mode: "edit" | "preview"
  onModeToggle?: () => void
}) => {
  if (mode === "preview") {
    return (
      <>
        <Spacer />
        <ModeToggleButton mode={mode} onToggle={onModeToggle} />
      </>
    )
  }

  return (
    <>
      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu modal={false} levels={[1, 2, 3, 4]} />
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="underline" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ListDropdownMenu modal={false} types={["bulletList", "orderedList", "taskList"]} />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <CompactToolbarMenu label="Format">
          <DropdownMenuItem asChild>
            <MarkButton type="strike" text="Strikethrough" />
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <MarkButton type="code" text="Inline code" />
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <MarkButton type="superscript" text="Superscript" />
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <MarkButton type="subscript" text="Subscript" />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <TextAlignButton align="left" text="Align left" />
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <TextAlignButton align="center" text="Align center" />
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <TextAlignButton align="right" text="Align right" />
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <TextAlignButton align="justify" text="Justify" />
          </DropdownMenuItem>
        </CompactToolbarMenu>

        <CompactToolbarMenu label="Insert">
          <DropdownMenuItem asChild>
            <BlockquoteButton text="Blockquote" />
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <CodeBlockButton text="Code block" />
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <ImageUploadButton text="Image" />
          </DropdownMenuItem>
        </CompactToolbarMenu>
      </ToolbarGroup>

      <Spacer />
      <ModeToggleButton mode={mode} onToggle={onModeToggle} />
    </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link"
  onBack: () => void
}) => (
  <>
    <ToolbarGroup>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
)

export function SimpleEditor({
  content,
  onChange,
  editable = true,
  mode,
  onModeToggle,
}: SimpleEditorProps) {
  const isMobile = useIsBreakpoint()
  const { height } = useWindowSize()
  const lastEmittedMarkdown = useRef(content)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)
  const [mobileView, setMobileView] = useState<"main" | "highlighter" | "link">(
    "main"
  )
  const toolbarRef = useRef<HTMLDivElement>(null)
  const currentMode = mode ?? (editable ? "edit" : "preview")

  const insertUploadedImages = async (files: File[], insertAtPos?: number) => {
      const activeEditor = editorRef.current
      if (!activeEditor || !activeEditor.isEditable) return

      const imageFiles = files.filter((file) => file.type.startsWith("image/"))
      if (imageFiles.length === 0) return

      let targetPos = insertAtPos
      if (typeof targetPos === "number") {
        activeEditor
          .chain()
          .focus()
          .setTextSelection(Math.max(1, targetPos))
          .run()
      }

      for (const file of imageFiles) {
        try {
          const src = await handleImageUpload(file)
          if (!src) continue

          const title = file.name.replace(/\.[^/.]+$/, "") || "image"
          activeEditor
            .chain()
            .focus()
            .setImage({
              src,
              alt: title,
              title,
            })
            .run()
        } catch (error) {
          console.error("Image drop/paste upload failed:", error)
        }
      }
  }

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !editable) return false

        const droppedFiles = Array.from(event.dataTransfer?.files || [])
        const imageFiles = droppedFiles.filter((file) =>
          file.type.startsWith("image/")
        )

        if (imageFiles.length === 0) return false

        event.preventDefault()
        const coordinates = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })
        void insertUploadedImages(imageFiles, coordinates?.pos)
        return true
      },
      handlePaste: (_view, event) => {
        if (!editable) return false

        const pastedFiles = Array.from(event.clipboardData?.files || [])
        const imageFiles = pastedFiles.filter((file) =>
          file.type.startsWith("image/")
        )

        if (imageFiles.length === 0) return false

        event.preventDefault()
        void insertUploadedImages(imageFiles)
        return true
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
    ],
    content: markdownInput.render(content),
    onUpdate({ editor: activeEditor }) {
      const markdown = turndown.turndown(activeEditor.getHTML())
      lastEmittedMarkdown.current = markdown
      onChange(markdown)
    },
  })

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    if (!isMobile && mobileView !== "main") {
      setMobileView("main")
    }
  }, [isMobile, mobileView])

  useEffect(() => {
    if (!editor) return
    if (content === lastEmittedMarkdown.current) return

    const currentMarkdown = turndown.turndown(editor.getHTML())
    if (currentMarkdown === content) return

    editor.commands.setContent(markdownInput.render(content), {
      emitUpdate: false,
    })
    lastEmittedMarkdown.current = content
  }, [content, editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])

  return (
    <div className="simple-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        {(editable || onModeToggle) && (
          <Toolbar
            ref={toolbarRef}
            style={{
              ...(isMobile
                ? {
                    bottom: `calc(100% - ${height - rect.y}px)`,
                  }
                : {}),
            }}
          >
            {mobileView === "main" ? (
              <MainToolbarContent
                onHighlighterClick={() => setMobileView("highlighter")}
                onLinkClick={() => setMobileView("link")}
                isMobile={isMobile}
                mode={currentMode}
                onModeToggle={onModeToggle}
              />
            ) : (
              currentMode === "edit" && (
                <MobileToolbarContent
                  type={mobileView === "highlighter" ? "highlighter" : "link"}
                  onBack={() => setMobileView("main")}
                />
              )
            )}
          </Toolbar>
        )}

        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />
      </EditorContext.Provider>
    </div>
  )
}

export default SimpleEditor
