'use client';

export default function OfflinePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#07100a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      color: '#e8f2ea',
      padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📡</div>
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 700,
          fontSize: 24,
          marginBottom: 12,
          color: '#c9a227',
        }}>
          Sin conexión a internet
        </h1>
        <p style={{ color: '#8dab94', lineHeight: 1.6, marginBottom: 24 }}>
          No te preocupes — si estabas capturando encuestas, se guardaron automáticamente
          en tu dispositivo y se enviarán cuando recuperes la conexión.
        </p>
        <div style={{
          background: '#0f1d12',
          border: '1px solid #264030',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
        }}>
          <p style={{ color: '#8dab94', fontSize: 14, margin: 0 }}>
            💡 Puedes seguir capturando encuestas en modo offline.
            Abre la app desde tu pantalla de inicio.
          </p>
        </div>
        <button
          onClick={() => typeof window !== 'undefined' && window.location.reload()}
          style={{
            padding: '12px 28px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #c9a227 0%, #a07d1a 100%)',
            border: 'none',
            color: '#07100a',
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Reintentar conexión
        </button>
      </div>
    </div>
  );
}
