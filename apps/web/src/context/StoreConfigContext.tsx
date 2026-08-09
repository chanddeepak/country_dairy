'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  fetchFeatureFlags,
  fetchWhatsAppConfig,
  type WhatsAppConfig,
} from '../lib/storeConfig';

interface StoreConfigValue {
  whatsapp: WhatsAppConfig | null;
  flags: Record<string, boolean>;
  isLoading: boolean;
  /** Unknown flags read as false, so a missing row cannot open a feature. */
  isFlagOn: (key: string) => boolean;
}

const StoreConfigContext = createContext<StoreConfigValue>({
  whatsapp: null,
  flags: {},
  isLoading: true,
  isFlagOn: () => false,
});

/**
 * Loads storefront configuration once and shares it. Feature flags and the
 * WhatsApp number live in the database so they can be changed from the admin
 * console without a redeploy.
 */
export function StoreConfigProvider({ children }: { children: React.ReactNode }) {
  const [whatsapp, setWhatsapp] = useState<WhatsAppConfig | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchWhatsAppConfig(), fetchFeatureFlags()])
      .then(([wa, f]) => {
        if (cancelled) return;
        setWhatsapp(wa);
        setFlags(f);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StoreConfigContext.Provider
      value={{
        whatsapp,
        flags,
        isLoading,
        isFlagOn: (key) => flags[key] === true,
      }}
    >
      {children}
    </StoreConfigContext.Provider>
  );
}

export function useStoreConfig(): StoreConfigValue {
  return useContext(StoreConfigContext);
}
