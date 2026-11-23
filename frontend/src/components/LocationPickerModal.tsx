import React, { useState } from 'react';
import { LocationPayload } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSend: (location: LocationPayload) => void;
}

export const LocationPickerModal: React.FC<Props> = ({ isOpen, onClose, onSend }) => {
  const [latitude, setLatitude] = useState('32.0853');
  const [longitude, setLongitude] = useState('34.7818');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [geoError, setGeoError] = useState('');

  if (!isOpen) return null;

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
        setGeoError('');
      },
      () => setGeoError('Could not read the current location. Enter coordinates manually.')
    );
  };

  const handleSend = () => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setGeoError('Latitude and longitude are required.');
      return;
    }
    onSend({
      latitude: lat,
      longitude: lng,
      ...(name.trim() && { name: name.trim() }),
      ...(address.trim() && { address: address.trim() })
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-1">Share location</h2>
        <p className="text-sm text-gray-500 mb-4">Send a location pin with coordinates, and an optional name and address.</p>

        <button
          type="button"
          onClick={handleUseMyLocation}
          className="mb-4 w-full px-4 py-2 border border-green-500 text-green-600 rounded hover:bg-green-50"
        >
          Use my current location
        </button>

        <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
        <input className="w-full p-2 border rounded mb-3" value={latitude} onChange={e => setLatitude(e.target.value)} />

        <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
        <input className="w-full p-2 border rounded mb-3" value={longitude} onChange={e => setLongitude(e.target.value)} />

        <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
        <input className="w-full p-2 border rounded mb-3" value={name} onChange={e => setName(e.target.value)} placeholder="Office" />

        <label className="block text-sm font-medium text-gray-700 mb-1">Address (optional)</label>
        <input className="w-full p-2 border rounded mb-3" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" />

        {geoError && <p className="text-sm text-red-500 mb-3">{geoError}</p>}

        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
          <button onClick={handleSend} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">Send pin</button>
        </div>
      </div>
    </div>
  );
};
