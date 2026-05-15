// Shared UI component primitives used across pages
// These are just simple styled components to keep the UI consistent and make it easy to build new pages without worrying about design details. 
// They use inline styles for simplicity, but could be switched to CSS modules or a library like styled-components if desired.

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: 'var(--shadow)',
      ...style
    }}>
      {children}
    </div>
  );
}

// Page and section titles with consistent styling, plus optional subtitle for page title
export function PageTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.875rem',
        fontWeight: 600,
        color: 'var(--text)',
        letterSpacing: '-0.01em',
        marginBottom: '0.5rem'
      }}>
        {children}
      </h1>
      {sub && <p style={{ color: 'var(--text-light)', fontSize: '14px', marginTop: '0.25rem' }}>{sub}</p>}
    </div>
  );
}

// Section titles for breaking up pages into parts
export function SectionTitle({ children }) {
  return <h2 style={{
    fontFamily: 'var(--font-display)',
    fontSize: '1.25rem',
    color: 'var(--text)',
    marginBottom: '1rem',
    fontWeight: 600
  }}>{children}</h2>;
}

// Button component with variants for primary, danger, success, and ghost styles. Disabled state and custom styles supported.
export function Btn({ children, onClick, variant = 'default', disabled = false, style = {} }) {
  const variants = {
    default: {
      background: 'var(--surface2)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
      hoverBg: '#f3f4f6'
    },
    primary: {
      background: 'var(--accent)',
      color: '#ffffff',
      border: 'none',
      hoverBg: 'var(--accent-hover)'
    },
    danger: {
      background: 'var(--danger)',
      color: '#fff',
      border: 'none',
      hoverBg: '#dc2626'
    },
    success: {
      background: 'var(--success)',
      color: '#fff',
      border: 'none',
      hoverBg: '#059669'
    },
    ghost: {
      background: 'none',
      color: 'var(--accent)',
      border: '1px solid var(--accent)',
      hoverBg: 'rgba(59,130,246,0.05)'
    },
  };

  const variantStyle = variants[variant];

  // For disabled state, we can either use the default variant style with reduced opacity or define specific disabled styles. 
  // We just reduce opacity and change cursor here.
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '14px',
        fontWeight: '500',
        padding: '0.625rem 1.25rem',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s',
        ...variantStyle,
        ...style
      }}
      onMouseEnter={(e) => {
        if (!disabled && variantStyle.hoverBg) {
          e.currentTarget.style.background = variantStyle.hoverBg;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = variantStyle.background || variantStyle.backgroundColor || variantStyle.background;
        }
      }}
    >
      {children}
    </button>
  );
}

// Form components: Input, Select, Textarea with consistent styling and focus states. Label support and custom styles allowed.
export function Input({ label, value, onChange, type = 'text', placeholder = '', required = false, style = {} }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', ...style }}>
      {label && <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--text)',
        letterSpacing: '0',
      }}>{label}{required && ' *'}</span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          borderRadius: '8px',
          padding: '0.625rem 0.875rem',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          outline: 'none',
          width: '100%',
          transition: 'all 0.2s',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--accent)';
          e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--border)';
          e.target.style.boxShadow = 'none';
        }}
      />
    </label>
  );
}

// For Select options, we allow either simple strings or objects with value and label properties for more complex cases. The component handles both.
export function Select({ label, value, onChange, options, style = {} }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', ...style }}>
      {label && <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--text)'
      }}>{label}</span>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          borderRadius: '8px',
          padding: '0.625rem 0.875rem',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          outline: 'none',
          width: '100%',
          cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
        ))}
      </select>
    </label>
  );
}

// Textarea component with auto-resize, label support, and consistent styling. Custom styles allowed. Focus states included for better UX.
export function Textarea({ label, value, onChange, rows = 4, placeholder = '', style = {} }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', ...style }}>
      {label && <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--text)'
      }}>{label}</span>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          borderRadius: '8px',
          padding: '0.625rem 0.875rem',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          outline: 'none',
          width: '100%',
          resize: 'vertical',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--accent)';
          e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--border)';
          e.target.style.boxShadow = 'none';
        }}
      />
    </label>
  );
}

// Alert component for displaying messages with different severity levels (info, warning, danger, success). 
// Colors and icons can be customized based on type. Consistent styling for all alerts.
export function Alert({ children, type = 'info' }) {
  const colors = {
    info: 'var(--accent)',
    warn: 'var(--warn)',
    danger: 'var(--danger)',
    success: 'var(--success)'
  };

  const backgrounds = {
    info: '#eff6ff',
    warn: '#fffbeb',
    danger: '#fef2f2',
    success: '#f0fdf4'
  };

  return (
    <div style={{
      borderRadius: '8px',
      padding: '1rem',
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
      background: backgrounds[type],
      borderLeft: `4px solid ${colors[type]}`,
      color: 'var(--text)',
      marginBottom: '1rem',
    }}>
      {children}
    </div>
  );
}

// Table component for displaying tabular data with headers and rows. 
// Supports empty state message when no data is available. 
// Responsive design with horizontal scrolling on smaller screens.

export function Table({ headers, rows, emptyMsg = 'No data.' }) {
  return (
    <div style={{
      overflowX: 'auto',
      background: 'var(--surface)',
      borderRadius: '12px',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow)'
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'var(--font-body)',
        fontSize: '14px',
        minWidth: '600px'
      }}>
        <thead>
          <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {headers.map(h => (
              <th key={h} style={{
                textAlign: 'left',
                padding: '1rem',
                color: 'var(--text-light)',
                fontWeight: 600,
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} style={{ padding: '2rem', color: 'var(--muted)', textAlign: 'center' }}>
                {emptyMsg}
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={i} style={{
              borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
              transition: 'background 0.15s'
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '1rem', color: 'var(--text)' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Star rating component for displaying and selecting ratings. Supports custom max rating and onChange handler for interactivity.

export function Stars({ value, max = 5, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          onClick={() => onChange && onChange(i + 1)}
          style={{
            cursor: onChange ? 'pointer' : 'default',
            fontSize: '1.25rem',
            color: i < value ? 'var(--accent)' : 'var(--border)',
            transition: 'color 0.2s'
          }}
        >★</span>
      ))}
    </div>
  );
}

// Tag component for displaying small labels or categories. Color can be customized via props, defaulting to a neutral border color. 
// Consistent styling for all tags.
export function Tag({ children, color = 'var(--border)' }) {
  return (
    <span style={{
      background: color + '10',
      color: color,
      border: `1px solid ${color}`,
      borderRadius: '6px',
      padding: '2px 8px',
      fontSize: '11px',
      fontFamily: 'var(--font-body)',
      fontWeight: 500,
      letterSpacing: '0',
    }}>{children}</span>
  );
}

// Grid component for creating responsive layouts. The number of columns can be customized via props, defaulting to 2.
export function Grid({ children, cols = 2 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: '1.5rem'
    }}>
      {children}
    </div>
  );
}

// New component for dashboard cards (like in the reference image)
export function DashboardCard({ title, value, subtitle, icon }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '1.25rem',
      boxShadow: 'var(--shadow)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow)';
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ color: 'var(--text-light)', fontSize: '13px', fontWeight: 500 }}>{title}</span>
        {icon && <span style={{ fontSize: '20px', color: 'var(--accent)' }}>{icon}</span>}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>{value}</div>
      {subtitle && <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{subtitle}</div>}
    </div>
  );
}