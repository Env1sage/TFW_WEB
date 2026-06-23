import React, { useState, useCallback } from 'react';
import { api } from '../api';

interface ShippingRate {
  carrier: string;
  carrierLabel: string;
  courierName: string;
  mode: string;
  estimatedDays: string;
  baseRate: number;
  gst: number;
  totalRate: number;
  chargeableWeightKg: number;
  available: boolean;
  source: 'live' | 'fallback' | 'cached';
  error?: string;
}

interface WeightResult {
  deadWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  volumetricDivisor: number;
}

interface Props {
  weightGrams: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  declaredValue?: number;
  onSelect?: (rate: ShippingRate) => void;
  selectedCarrier?: string;
}

const CARRIER_ICONS: Record<string, string> = {
  shiprocket: '🚀',
  delhivery:  '📦',
  bluedart:   '🔵',
  dtdc:       '🟡',
};

export default function ShippingRateWidget({
  weightGrams,
  lengthCm  = 10,
  widthCm   = 10,
  heightCm  = 5,
  declaredValue = 100,
  onSelect,
  selectedCarrier,
}: Props) {
  const [pincode, setPincode]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState('');
  const [weights, setWeights]   = useState<WeightResult | null>(null);
  const [rates,   setRates]     = useState<ShippingRate[] | null>(null);

  const fetchRates = useCallback(async () => {
    if (!/^\d{6}$/.test(pincode)) { setError('Enter a valid 6-digit pincode'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await api.getShippingRates({
        toPin: pincode,
        weightGrams,
        lengthCm,
        widthCm,
        heightCm,
        declaredValue,
      });
      setWeights(result.weights);
      setRates(result.carriers.filter((r) => r.available));
    } catch (e: any) {
      setError(e.message || 'Failed to fetch shipping rates');
    } finally {
      setLoading(false);
    }
  }, [pincode, weightGrams, lengthCm, widthCm, heightCm, declaredValue]);

  const available = rates?.filter(r => r.available) ?? [];
  const cheapest  = available.length ? available[0] : null;

  return (
    <div className="srw-wrap">
      {/* Pincode Input */}
      <div className="srw-pin-row">
        <input
          className="srw-pin-input"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter delivery pincode"
          value={pincode}
          onChange={(e) => { setPincode(e.target.value.replace(/\D/g, '')); setRates(null); }}
          onKeyDown={(e) => e.key === 'Enter' && fetchRates()}
        />
        <button className="srw-check-btn" onClick={fetchRates} disabled={loading}>
          {loading ? <span className="srw-spin" /> : 'Check'}
        </button>
      </div>

      {error && <p className="srw-error">{error}</p>}

      {/* Weight Breakdown (collapsed by default) */}
      {weights && (
        <details className="srw-weight-details">
          <summary className="srw-weight-summary">
            Chargeable weight: <strong>{weights.chargeableWeightKg} kg</strong>
          </summary>
          <div className="srw-weight-grid">
            <span>Dead weight</span>     <span>{weights.deadWeightKg} kg</span>
            <span>Volumetric weight</span><span>{weights.volumetricWeightKg} kg</span>
            <span>Divisor</span>          <span>{weights.volumetricDivisor}</span>
          </div>
        </details>
      )}

      {/* Rate Cards */}
      {rates !== null && (
        <div className="srw-rates">
          {available.length === 0 ? (
            <p className="srw-no-rates">No shipping options available for this pincode.</p>
          ) : (
            available.map((r) => {
              const isSelected = selectedCarrier === r.carrier;
              const isCheapest = cheapest && r.courierName === cheapest.courierName && r.totalRate === cheapest.totalRate;
              return (
                <div
                  key={`${r.carrier}-${r.courierName}`}
                  className={`srw-rate-card${isSelected ? ' srw-selected' : ''}`}
                  onClick={() => onSelect?.(r)}
                  role={onSelect ? 'button' : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect?.(r)}
                >
                  <div className="srw-rate-left">
                    <span className="srw-carrier-icon">{CARRIER_ICONS[r.carrier] || '📬'}</span>
                    <div className="srw-carrier-info">
                      <span className="srw-courier-name">{r.courierName}</span>
                      <span className="srw-eta">{r.estimatedDays} · {r.mode}</span>
                    </div>
                    {isCheapest && <span className="srw-badge-cheap">Cheapest</span>}
                    {r.source === 'fallback' && <span className="srw-badge-est">Est.</span>}
                  </div>
                  <div className="srw-rate-right">
                    <span className="srw-total">₹{r.totalRate}</span>
                    <span className="srw-breakdown">₹{r.baseRate} + ₹{r.gst} GST</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
