'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, Loader2, CheckCircle, LogOut } from 'lucide-react';

interface WhatsAppQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  onConnected: (sessionId: string, phoneNumber: string) => void;
}

export default function WhatsAppQRModal({
  isOpen,
  onClose,
  userId,
  companyId,
  onConnected,
}: WhatsAppQRModalProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const initializeQRCode = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/whatsapp/qr-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, companyId }),
      });

      if (!response.ok) {
        throw new Error('Falha ao inicializar QR code');
      }

      const data = await response.json();
      setSessionId(data.sessionId);

      if (data.qrCode === 'connected') {
        setIsConnected(true);
        setPhoneNumber(data.phoneNumber);
        setLoading(false);
        onConnected(data.sessionId, data.phoneNumber);
      } else {
        setQrCode(data.qrCode);
        setLoading(false);
        startPolling(data.sessionId);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao gerar QR code'
      );
      setLoading(false);
    }
  }, [userId, companyId, onConnected]);

  const startPolling = useCallback((sid: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/whatsapp/session-status?sessionId=${sid}`);
        const data = await response.json();

        if (data.isConnected) {
          setIsConnected(true);
          setPhoneNumber(data.phoneNumber);
          setQrCode(null);
          if (interval) clearInterval(interval);
          setPollInterval(null);
          onConnected(sid, data.phoneNumber);
        }
      } catch (error) {
        console.error('Erro ao fazer polling:', error);
      }
    }, 2000);

    setPollInterval(interval);
  }, [onConnected]);

  useEffect(() => {
    if (isOpen) {
      initializeQRCode();
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isOpen, initializeQRCode, pollInterval]);

  const handleDisconnect = async () => {
    if (!sessionId) return;

    try {
      await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      setIsConnected(false);
      setPhoneNumber(null);
      setSessionId(null);
      setQrCode(null);
      initializeQRCode();
    } catch (error) {
      setError('Falha ao desconectar');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-xl">
        <h2 className="text-2xl font-bold mb-6">Conectar WhatsApp</h2>

        {loading && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Gerando código QR...</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Erro</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {qrCode && !isConnected && !loading && (
          <div className="flex flex-col items-center">
            <p className="text-gray-600 text-sm mb-4">
              Escaneie este código QR com o WhatsApp:
            </p>
            <div className="bg-white p-2 border-2 border-gray-200 rounded-lg mb-4">
              <img
                src={`data:image/png;base64,${qrCode}`}
                alt="WhatsApp QR Code"
                width={200}
                height={200}
                className="w-48 h-48"
              />
            </div>
            <p className="text-xs text-gray-500 text-center">
              O código expira em 60 segundos. Se isso acontecer, atualize a página.
            </p>
          </div>
        )}

        {isConnected && phoneNumber && (
          <div className="flex flex-col items-center">
            <CheckCircle className="w-12 h-12 text-green-600 mb-4" />
            <p className="text-lg font-semibold text-green-700 mb-2">Conectado!</p>
            <p className="text-gray-600 mb-6">
              WhatsApp conectado ao número: <span className="font-mono font-semibold">{phoneNumber}</span>
            </p>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition"
            >
              <LogOut className="w-4 h-4" />
              Desconectar
            </button>
          </div>
        )}

        {!isConnected && !loading && (
          <button
            onClick={onClose}
            className="w-full mt-6 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
          >
            Fechar
          </button>
        )}

        {isConnected && (
          <button
            onClick={onClose}
            className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Continuar
          </button>
        )}
      </div>
    </div>
  );
}
