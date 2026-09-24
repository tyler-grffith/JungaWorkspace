// The shared desktop-application shell. It renders a spec (menus, ribbon, tree, viewport, status)
// and owns only presentation state: which menu is open, which tree nodes are expanded, the
// property panel's draft values. Everything that changes a document goes back through callbacks,
// so the modeler and slicer keep their own models and this component stays dumb.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react'
import type {
  Menu,
  PanelTab,
  ParamDef,
  ParamValue,
  RibbonTab,
  StatusItem,
  ToolDef,
  TreeNode,
} from './types'
import './workbench.css'

export type WorkbenchProps = {
  app: { name: string; theme: 'light' | 'dark'; accent: string; documentName: string }
  menus: Menu[]
  ribbon: RibbonTab[]
  activeTab: string
  onTab: (id: string) => void
  tree: {
    title: string
    nodes: TreeNode[]
    selectedId: string | null
    onSelect: (id: string) => void
    tabs?: PanelTab[]
    activeTab?: string
    onTreeTab?: (id: string) => void
    /** Content shown instead of the node list when a non-tree panel tab is active. */
    panel?: ReactNode
  }
  activeTool: ToolDef | null
  toolValues: Record<string, ParamValue>
  onToolValue: (id: string, value: ParamValue) => void
  onToolOk: () => void
  onToolCancel: () => void
  onTool: (tool: ToolDef) => void
  onCommand: (command: string) => void
  viewport: ReactNode
  viewToolbar?: ToolDef[]
  onViewTool?: (id: string) => void
  activeViewTools?: string[]
  rightPanel?: ReactNode
  status: StatusItem[]
  message?: string
  readOnly?: boolean
}

export default function Workbench(props: WorkbenchProps) {
  const { app, menus, ribbon, tree, activeTool } = props
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const root = useRef<HTMLDivElement>(null)
  const tab = ribbon.find((t) => t.id === props.activeTab) ?? ribbon[0]

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.wb-menubar')) setOpenMenu(null)
    }
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null)
        if (activeTool) props.onToolCancel()
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', keys)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', keys)
    }
  })

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const hasChildren = !!node.children?.length
    const isCollapsed = collapsed.has(node.id)
    const Icon = node.icon
    return (
      <li
        key={node.id}
        role="treeitem"
        aria-expanded={hasChildren ? !isCollapsed : undefined}
        aria-selected={node.id === tree.selectedId}
      >
        <div
          className={`wb-tree-row ${node.id === tree.selectedId ? 'selected' : ''} ${node.suppressed ? 'suppressed' : ''}`}
          style={{ paddingLeft: 6 + depth * 14 }}
        >
          {hasChildren ? (
            <button
              type="button"
              className="wb-tree-toggle"
              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${node.label}`}
              onClick={() => toggle(node.id)}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          ) : (
            <span className="wb-tree-toggle" aria-hidden="true" />
          )}
          <button type="button" className="wb-tree-label" onClick={() => tree.onSelect(node.id)}>
            {Icon && <Icon size={14} aria-hidden="true" />}
            <span>{node.label}</span>
            {node.badge && <span className="wb-tree-badge">{node.badge}</span>}
          </button>
        </div>
        {hasChildren && !isCollapsed && (
          <ul role="group">{node.children!.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    )
  }

  return (
    <div
      className={`workbench theme-${app.theme}`}
      ref={root}
      style={{ '--wb-accent': app.accent } as React.CSSProperties}
    >
      <div className="wb-titlebar">
        <span className="wb-app-name">{app.name}</span>
        <span className="wb-doc-name">{app.documentName}</span>
        <span className="wb-message" role="status">
          {props.message}
        </span>
        {props.readOnly && <span className="wb-readonly">Read only</span>}
      </div>
      <div className="wb-menubar" role="menubar" aria-label={`${app.name} menu`}>
        {menus.map((menu) => (
          <div key={menu.label} className="wb-menu" role="none">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openMenu === menu.label}
              className={openMenu === menu.label ? 'open' : ''}
              onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
              onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
            >
              {menu.label}
            </button>
            {openMenu === menu.label && (
              <div className="wb-dropdown" role="menu" aria-label={menu.label}>
                {menu.items.map((item, index) =>
                  item === 'separator' ? (
                    <hr key={index} />
                  ) : (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      onClick={() => {
                        setOpenMenu(null)
                        if (item.command) props.onCommand(item.command)
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <kbd>{item.shortcut}</kbd>}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="wb-ribbon">
        <div className="wb-ribbon-tabs" role="tablist" aria-label="Command tabs">
          {ribbon.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab.id}
              className={t.id === tab.id ? 'active' : ''}
              onClick={() => props.onTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="wb-ribbon-groups" role="tabpanel" aria-label={`${tab.label} commands`}>
          {tab.groups.map((group) => (
            <div key={group.label} className="wb-ribbon-group">
              <div className="wb-ribbon-tools">
                {group.tools.map((tool) => {
                  const Icon = tool.icon
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      className={`wb-tool ${activeTool?.id === tool.id ? 'active' : ''}`}
                      title={tool.hint ?? tool.label}
                      aria-label={tool.label}
                      aria-pressed={activeTool?.id === tool.id}
                      disabled={tool.disabled || props.readOnly}
                      onClick={() => props.onTool(tool)}
                    >
                      <Icon size={22} aria-hidden="true" />
                      <span>{tool.label}</span>
                    </button>
                  )
                })}
              </div>
              <div className="wb-ribbon-group-label">{group.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className={`wb-body ${props.rightPanel ? 'with-right' : ''}`}>
        <aside className="wb-left" aria-label="Side panel">
          {tree.tabs && (
            <div className="wb-panel-tabs" role="tablist" aria-label="Panels">
              {tree.tabs.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={t.id === tree.activeTab}
                    aria-label={t.label}
                    title={t.label}
                    className={t.id === tree.activeTab ? 'active' : ''}
                    onClick={() => tree.onTreeTab?.(t.id)}
                  >
                    <Icon size={15} />
                  </button>
                )
              })}
            </div>
          )}
          {activeTool ? (
            <PropertyPanel
              tool={activeTool}
              values={props.toolValues}
              onValue={props.onToolValue}
              onOk={props.onToolOk}
              onCancel={props.onToolCancel}
            />
          ) : tree.panel ? (
            <div className="wb-panel">{tree.panel}</div>
          ) : (
            <div className="wb-tree">
              <div className="wb-panel-title">{tree.title}</div>
              <ul role="tree" aria-label={tree.title}>
                {tree.nodes.map((node) => renderNode(node, 0))}
              </ul>
            </div>
          )}
        </aside>
        <section className="wb-viewport" aria-label="Viewport">
          {props.viewToolbar && (
            <div className="wb-view-toolbar" role="toolbar" aria-label="View">
              {props.viewToolbar.map((tool) => {
                const Icon = tool.icon
                const active = props.activeViewTools?.includes(tool.id)
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className={active ? 'active' : ''}
                    aria-pressed={active}
                    aria-label={tool.label}
                    title={tool.hint ?? tool.label}
                    onClick={() => props.onViewTool?.(tool.id)}
                  >
                    <Icon size={16} />
                  </button>
                )
              })}
            </div>
          )}
          {props.viewport}
        </section>
        {props.rightPanel && (
          <aside className="wb-right" aria-label="Details panel">
            {props.rightPanel}
          </aside>
        )}
      </div>
      <div className="wb-status" role="status">
        {props.status.map((item) => {
          const Icon = item.icon
          return (
            <span key={item.id}>
              {Icon && <Icon size={12} aria-hidden="true" />}
              {item.text}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** The property panel for a running tool: its parameters plus OK and Cancel, as in SolidWorks. */
export function PropertyPanel({
  tool,
  values,
  onValue,
  onOk,
  onCancel,
}: {
  tool: ToolDef
  values: Record<string, ParamValue>
  onValue: (id: string, value: ParamValue) => void
  onOk: () => void
  onCancel: () => void
}) {
  const Icon = tool.icon
  return (
    <form
      className="wb-properties"
      aria-label={`${tool.label} properties`}
      onSubmit={(event) => {
        event.preventDefault()
        onOk()
      }}
    >
      <div className="wb-properties-head">
        <Icon size={16} aria-hidden="true" />
        <span>{tool.label}</span>
        <button type="submit" className="wb-ok" aria-label="Accept (OK)">
          <Check size={16} />
        </button>
        <button
          type="button"
          className="wb-cancel"
          aria-label="Dismiss (Cancel)"
          onClick={onCancel}
        >
          <X size={16} />
        </button>
      </div>
      {tool.hint && <p className="wb-properties-hint">{tool.hint}</p>}
      {(tool.params ?? []).map((param) => (
        <ParamField
          key={param.id}
          param={param}
          value={values[param.id] ?? param.default}
          onChange={(value) => onValue(param.id, value)}
        />
      ))}
      <div className="wb-properties-actions">
        <button type="submit" className="wb-button primary">
          OK
        </button>
        <button type="button" className="wb-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
export function ParamField({
  param,
  value,
  onChange,
}: {
  param: ParamDef
  value: ParamValue
  onChange: (value: ParamValue) => void
}) {
  switch (param.kind) {
    case 'number':
      return (
        <label className="wb-field">
          <span>
            {param.label}
            {param.unit ? ` (${param.unit})` : ''}
          </span>
          <input
            type="number"
            value={Number(value)}
            min={param.min}
            max={param.max}
            step={param.step ?? 'any'}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </label>
      )
    case 'select':
      return (
        <label className="wb-field">
          <span>{param.label}</span>
          <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
            {(param.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      )
    case 'toggle':
      return (
        <label className="wb-field inline">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{param.label}</span>
        </label>
      )
    default:
      return (
        <label className="wb-field">
          <span>{param.label}</span>
          <input type="text" value={String(value)} onChange={(e) => onChange(e.target.value)} />
        </label>
      )
  }
}
