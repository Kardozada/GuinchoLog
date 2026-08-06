import React, { useState, useEffect, useRef } from 'react';
import { User, FuelRecord } from '../types';
import { VEHICLES, POSTOS, TIPOS_COMBUSTIVEL, getLocalDate } from '../constants';
import { saveFuelRecord, getFuelRecordsByUser } from '../services/storage';
import { Droplet, Calendar, Loader2, CheckCircle, Save, Camera, Image as ImageIcon, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface RefuelFormProps {
  user: User;
}

const RefuelForm: React.FC<RefuelFormProps> = ({ user }) => {
  const [date, setDate] = useState(getLocalDate());
  const [vehicleId, setVehicleId] = useState('');
  const [station, setStation] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [liters, setLiters] = useState<number | ''>('');
  const [pricePerLiter, setPricePerLiter] = useState<number | ''>('');
  const [odometer, setOdometer] = useState<number | ''>('');
  const [tanqueCheio, setTanqueCheio] = useState<boolean | null>(null);
  const [observations, setObservations] = useState('');
  const [proofImage, setProofImage] = useState<string>('');

  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRecords();
  }, [user.id]);

  const loadRecords = async () => {
    setIsLoading(true);
    const data = await getFuelRecordsByUser(user.id);
    setRecords(data);
    setIsLoading(false);
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('A imagem é muito grande. O limite é 10MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension 600px
          const maxDim = 600;
          if (width > height && width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          } else if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.5 quality to keep it well under 1MB for Firestore
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
          setProofImage(compressedBase64);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setProofImage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const total = (typeof liters === 'number' && typeof pricePerLiter === 'number') 
    ? liters * pricePerLiter 
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !station || !fuelType || !liters || !pricePerLiter || !odometer || !proofImage) {
      alert('Por favor, preencha todos os campos obrigatórios, incluindo o odômetro e o comprovante.');
      return;
    }

    if (tanqueCheio === null) {
      alert('Por favor, indique se completou o tanque ou foi um abastecimento parcial.');
      return;
    }

    setIsSubmitting(true);

    const record: FuelRecord = {
      id: uuidv4(),
      userId: user.id,
      driverName: user.name,
      date,
      vehicleId,
      station,
      fuelType,
      liters: Number(liters),
      pricePerLiter: Number(pricePerLiter),
      total: Number(liters) * Number(pricePerLiter),
      odometer: odometer ? Number(odometer) : undefined,
      tanqueCheio,
      observations,
      proofImage: proofImage || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      await saveFuelRecord(record);
      await loadRecords();
      resetForm();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar abastecimento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setDate(getLocalDate());
    setVehicleId('');
    setStation('');
    setFuelType('');
    setLiters('');
    setPricePerLiter('');
    setOdometer('');
    setTanqueCheio(null);
    setObservations('');
    setProofImage('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3">
          <Droplet className="w-6 h-6 text-indigo-600" />
          <h2 className="text-lg font-bold text-gray-900">
            Novo Abastecimento
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Veículo *</label>
              <select
                required
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Selecione o veículo...</option>
                {VEHICLES.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Posto *</label>
              <select
                required
                value={station}
                onChange={(e) => setStation(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Selecione o posto...</option>
                {POSTOS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Combustível *</label>
              <select
                required
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Selecione o combustível...</option>
                {TIPOS_COMBUSTIVEL.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Litros *</label>
              <input
                type="number"
                step="0.001"
                min="0.1"
                required
                value={liters}
                onChange={(e) => setLiters(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 50.5"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preço por Litro (R$) *</label>
              <input
                type="number"
                step="0.001"
                min="0.1"
                required
                value={pricePerLiter}
                onChange={(e) => setPricePerLiter(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 5.99"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Total (R$)</label>
              <div className="w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-lg font-bold text-gray-800">
                {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Odômetro / KM *</label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={odometer}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setOdometer(val === '' ? '' : Number(val));
                }}
                placeholder="Ex: 154000"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Abastecimento *</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className={`flex-1 flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${tanqueCheio === true ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="tanqueCheio" className="text-indigo-600 focus:ring-indigo-500 h-4 w-4" checked={tanqueCheio === true} onChange={() => setTanqueCheio(true)} />
                  <span className="ml-3 font-medium text-gray-900">Completei o tanque</span>
                </label>
                <label className={`flex-1 flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${tanqueCheio === false ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="tanqueCheio" className="text-indigo-600 focus:ring-indigo-500 h-4 w-4" checked={tanqueCheio === false} onChange={() => setTanqueCheio(false)} />
                  <span className="ml-3 font-medium text-gray-900">Abastecimento parcial</span>
                </label>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações (Opcional)</label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
                placeholder="Informações adicionais..."
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Comprovante de Abastecimento (Obrigatório)</label>
              
              {!proofImage ? (
                <div className="flex gap-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleImageCapture}
                  />
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="hidden" 
                    ref={cameraInputRef}
                    onChange={handleImageCapture}
                  />
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-gray-500 hover:text-indigo-600 hover:border-indigo-300"
                  >
                    <Camera className="w-8 h-8" />
                    <span className="text-sm font-medium">Tirar Foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-gray-500 hover:text-indigo-600 hover:border-indigo-300"
                  >
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-sm font-medium">Anexar Galeria</span>
                  </button>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 inline-block">
                  <img src={proofImage} alt="Comprovante" className="max-h-48 object-contain bg-gray-50" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg"
                    title="Remover imagem"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Abastecimento
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {showSuccess && (
        <div className="bg-green-50 text-green-800 p-4 rounded-lg flex items-center gap-3 animate-fade-in border border-green-200">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <p className="font-medium">Abastecimento salvo com sucesso!</p>
        </div>
      )}

      {/* Histórico */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-gray-600" />
            <h2 className="text-lg font-bold text-gray-900">Meus Abastecimentos</h2>
          </div>
          <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">
            {records.length}
          </span>
        </div>
        
        <div className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center">
              <Droplet className="w-12 h-12 mb-3 text-gray-300" />
              <p>Nenhum abastecimento registrado ainda.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {records.map(record => {
                const vehicle = VEHICLES.find(v => v.id === record.vehicleId);
                return (
                  <div key={record.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">
                            {new Date(record.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="text-indigo-600 font-semibold">{vehicle?.name || record.vehicleId}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-sm text-gray-600">
                          <div><span className="font-medium text-gray-700">Posto:</span> {record.station}</div>
                          <div><span className="font-medium text-gray-700">Combustível:</span> {record.fuelType}</div>
                          <div><span className="font-medium text-gray-700">Litros:</span> {record.liters} L</div>
                          <div><span className="font-medium text-gray-700">Preço:</span> R$ {record.pricePerLiter.toFixed(2)}</div>
                          <div><span className="font-medium text-gray-700">Odômetro:</span> {record.odometer || '-'}</div>
                          <div className="lg:col-span-2">
                            <span className="font-medium text-gray-700">Total:</span>{' '}
                            <span className="font-bold text-green-700">
                              {record.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          {(record.observations || record.proofImage) && (
                            <div className="col-span-2 lg:col-span-4 flex items-center justify-between mt-1 pt-1 border-t border-gray-100">
                              <span className="text-xs italic text-gray-500">
                                {record.observations ? `Obs: ${record.observations}` : ''}
                              </span>
                              {record.proofImage && (
                                <div className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                  <ImageIcon className="w-3 h-3" />
                                  <span>Comprovante</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RefuelForm;
