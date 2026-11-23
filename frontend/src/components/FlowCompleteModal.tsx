import React, { useEffect, useMemo, useState } from 'react';
import { FlowScreenOption, LastFlowSend } from '../types';
import { getFulfillmentOptions, getPaymentOptions } from '../utils/messagePayload';

export type FlowFormValues = {
  customer_name: string;
  fulfillment: string;
  payment_option_code: string;
  area: string;
  street: string;
  building_number: string;
  floor_number: string;
  apartment_number: string;
  landmark: string;
  store_id: string;
};

interface Props {
  isOpen: boolean;
  flowSend: LastFlowSend | null;
  onClose: () => void;
  onSubmit: (values: FlowFormValues, contextWamid?: string) => Promise<void> | void;
}

const emptyForm: FlowFormValues = {
  customer_name: '',
  fulfillment: 'delivery',
  payment_option_code: '',
  area: '',
  street: '',
  building_number: '',
  floor_number: '',
  apartment_number: '',
  landmark: '',
  store_id: ''
};

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  required
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) => (
  <label className="block mb-3">
    <span className="block text-sm font-medium text-gray-700 mb-1">
      {label}{required ? <span className="text-red-500"> *</span> : null}
    </span>
    <input
      className="w-full p-2 border rounded"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </label>
);

const RadioGroup = ({
  label,
  name,
  options,
  value,
  onChange
}: {
  label: string;
  name: string;
  options: FlowScreenOption[];
  value: string;
  onChange: (id: string) => void;
}) => (
  <div className="mb-3">
    <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
    <div className="flex flex-col gap-2">
      {options.map(option => (
        <label key={option.id} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            checked={value === option.id}
            onChange={() => onChange(option.id)}
          />
          {option.title}
        </label>
      ))}
    </div>
  </div>
);

const buildInitialForm = (screenData: LastFlowSend['screen_data']): FlowFormValues => {
  const fulfillmentOptions = getFulfillmentOptions(screenData);
  const fulfillment = fulfillmentOptions[0]?.id ?? 'delivery';
  const payments = getPaymentOptions(screenData, fulfillment);
  const stores = screenData?.pickup_stores?.filter(o => o?.id && o?.title) ?? [];

  return {
    ...emptyForm,
    customer_name: screenData?.customer_name?.trim() ?? '',
    fulfillment,
    payment_option_code: payments[0]?.id ?? '',
    store_id: fulfillment === 'pickup' ? stores[0]?.id ?? '' : ''
  };
};

export const FlowCompleteModal: React.FC<Props> = ({ isOpen, flowSend, onClose, onSubmit }) => {
  const screenData = flowSend?.screen_data ?? null;
  const fulfillmentOptions = useMemo(() => getFulfillmentOptions(screenData), [screenData]);

  const [form, setForm] = useState<FlowFormValues>(() => buildInitialForm(screenData));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(buildInitialForm(screenData));
    setError('');
    setSubmitting(false);
  }, [isOpen, flowSend?.wamid]);

  if (!isOpen) return null;

  const set = (key: keyof FlowFormValues) => (value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleFulfillmentChange = (fulfillment: string) => {
    const payments = getPaymentOptions(screenData, fulfillment);
    const stores = screenData?.pickup_stores?.filter(o => o?.id && o?.title) ?? [];
    setForm(prev => ({
      ...prev,
      fulfillment,
      payment_option_code: payments[0]?.id ?? '',
      store_id: fulfillment === 'pickup' ? stores[0]?.id ?? '' : ''
    }));
  };

  const handleClose = () => {
    setError('');
    setSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!flowSend?.flow_token) {
      setError('This chat has no Flow token to complete. Send a Flow card first.');
      return;
    }
    if (!form.customer_name.trim()) {
      setError('Customer name is required.');
      return;
    }

    const payments = getPaymentOptions(screenData, form.fulfillment);
    const stores = screenData?.pickup_stores?.filter(o => o?.id && o?.title) ?? [];
    const paymentFromRadios = payments.length > 0;
    const storeFromRadios = form.fulfillment === 'pickup' && stores.length > 0;

    if (!form.payment_option_code.trim()) {
      setError(
        paymentFromRadios
          ? 'Select a payment option.'
          : 'Payment option code is required (copy it from ordr admin).'
      );
      return;
    }
    if (form.fulfillment === 'pickup' && !form.store_id.trim()) {
      setError(storeFromRadios ? 'Select a pickup store.' : 'Store ID is required for pickup.');
      return;
    }
    if (form.fulfillment === 'delivery' && (!form.area.trim() || !form.street.trim())) {
      setError('Area and street are required for delivery.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onSubmit(form, flowSend.wamid);
      setForm(emptyForm);
      handleClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to submit Flow reply');
      setSubmitting(false);
    }
  };

  const isDelivery = form.fulfillment === 'delivery';
  const activePayments = getPaymentOptions(screenData, form.fulfillment);
  const pickupStores = screenData?.pickup_stores?.filter(o => o?.id && o?.title) ?? [];
  const showPaymentRadios = activePayments.length > 0;
  const showStoreRadios = !isDelivery && pickupStores.length > 0;

  const heading = screenData?.heading || 'Complete details';
  const submitLabel = screenData?.cta_continue || 'Submit';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-1">{heading}</h2>
        <p className="text-sm text-gray-500 mb-4">
          Submits an <code>nfm_reply</code> webhook using the Flow token from the business message.
        </p>

        <label className="block mb-3">
          <span className="block text-sm font-medium text-gray-700 mb-1">flow_token</span>
          <input
            className="w-full p-2 border rounded bg-gray-50 text-gray-600 font-mono text-xs"
            value={flowSend?.flow_token || ''}
            readOnly
          />
        </label>

        <Field
          label={screenData?.label_name || 'Customer name'}
          value={form.customer_name}
          onChange={set('customer_name')}
          placeholder="Ada Lovelace"
          required
        />

        {fulfillmentOptions.length > 0 && (
          <RadioGroup
            label={screenData?.label_fulfillment || 'Fulfillment'}
            name="fulfillment"
            options={fulfillmentOptions}
            value={form.fulfillment}
            onChange={handleFulfillmentChange}
          />
        )}

        {showPaymentRadios ? (
          <RadioGroup
            label="Payment"
            name="payment_option_code"
            options={activePayments}
            value={form.payment_option_code}
            onChange={set('payment_option_code')}
          />
        ) : (
          <Field
            label="Payment option code"
            value={form.payment_option_code}
            onChange={set('payment_option_code')}
            placeholder="from ordr admin"
            required
          />
        )}

        {isDelivery ? (
          <>
            <Field label="Area" value={form.area} onChange={set('area')} required />
            <Field label="Street" value={form.street} onChange={set('street')} required />
            <Field label="Building number" value={form.building_number} onChange={set('building_number')} />
            <Field label="Floor number" value={form.floor_number} onChange={set('floor_number')} />
            <Field label="Apartment number" value={form.apartment_number} onChange={set('apartment_number')} />
            <Field label="Landmark" value={form.landmark} onChange={set('landmark')} />
          </>
        ) : showStoreRadios ? (
          <RadioGroup
            label="Pickup store"
            name="store_id"
            options={pickupStores}
            value={form.store_id}
            onChange={set('store_id')}
          />
        ) : (
          <Field
            label="Store ID"
            value={form.store_id}
            onChange={set('store_id')}
            placeholder="from ordr admin"
            required
          />
        )}

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-2">
          <button onClick={handleClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded" disabled={submitting}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-[#00a884] text-white rounded hover:bg-[#008f6f] disabled:opacity-60"
            disabled={submitting || !flowSend?.flow_token}
          >
            {submitting ? 'Sending…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
