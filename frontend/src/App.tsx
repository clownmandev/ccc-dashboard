import React, { useState, useEffect } from 'react';
import { 
  Activity, Server, Shield, Gamepad2, Terminal, Box, HardDrive, 
  Cpu, Wifi, Menu, Search, Router, Network, Bell, ArrowDownCircle,
  Thermometer, Zap, PlusCircle, X, Save
} from 'lucide-react';

// --- TYPES ---
interface TopClient {
  name: string;
  ip: string;
  usage: string;
  app: string;
}

interface SystemNode {
  id: string;
  name: string;
  type: 'fortigate' | 'switch' | 'ap' | 'proxmox' | 'ubuntu' | 'synology' | 'docker';
  status: 'online' | 'offline' | 'warning';
  cpu?: number;
  memory?: number;
  temp?: string;
  details: string; 
  subDetails?: string; 
}

export default function CoxCommandCenter() {
  const [nodes, setNodes] = useState<SystemNode[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // --- DATA FETCHING ---
  const fetchData = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/stats');
      const data = await res.json();

      const newNodes: SystemNode[] = [];

      // 1. Fortinet
      if (data.fortinet) {
        newNodes.push({
          id: 'fg-01', name: 'FortiGate 60F', type: 'fortigate',
          status: data.fortinet.gate.status,
          cpu: data.fortinet.gate.cpu, memory: data.fortinet.gate.ram,
          details: `${data.fortinet.gate.sessions} Sessions`, temp: '48°C'
        });

        data.fortinet.switches.forEach((sw: any, i: number) => {
          newNodes.push({
            id: `sw-${i}`, name: sw.name, type: 'switch', status: sw.status,
            details: `${sw.ports_up} Ports Up`, subDetails: `PoE: ${sw.power}`
          });
        });

        data.fortinet.aps.forEach((ap: any, i: number) => {
          newNodes.push({
            id: `ap-${i}`, name: ap.name, type: 'ap', status: ap.status,
            details: `${ap.clients} Clients`, subDetails: ap.model
          });
        });

        setTopClients(data.fortinet.topClients || []);
      }

      // 2. Proxmox
      if (data.proxmox) {
         newNodes.push({
           id: 'pve', name: 'Proxmox Cluster', type: 'proxmox', status: 'online',
           cpu: data.proxmox.cpu, memory: data.proxmox.ram,
           details: `${data.proxmox.vms} VMs Running`, temp: '42°C'
         });
      }

      // 3. Synology
      if (data.synology) {
        newNodes.push({
          id: 'nas', name: 'Synology NAS', type: 'synology', status: 'online',
          cpu: 10, memory: 40, 
          details: `Vol: ${data.synology.diskUsage}`, temp: data.synology.temp
        });
      }

      // 4. Ubuntu / Linux
      if (data.ubuntu) {
        // Handle single or array of Ubuntu nodes
        const ubuntuNodes = Array.isArray(data.ubuntu) ? data.ubuntu : [data.ubuntu];
        ubuntuNodes.forEach((ub: any, i: number) => {
             newNodes.push({
                id: `ub-${i}`, 
                name: ub.name || 'Ubuntu Server', 
                type: 'ubuntu',
                status: ub.status,
                cpu: ub.cpu || 0,
                memory: ub.ram || 0,
                details: `Disk: ${ub.disk}`,
                temp: 'N/A'
             });
        });
      }

      setNodes(newNodes);
      setLastUpdate(new Date());

    } catch (e) {
      console.error("Fetch failed", e);
    }
  };

  useEffect(() => {
    fetchData(); 
    const interval = setInterval(fetchData, 5000); 
    return () => clearInterval(interval);
  }, []);

  // --- ACTIONS ---
  const sendTestNotification = async () => {
    await fetch('http://localhost:3001/api/test-notify', { method: 'POST' });
    alert("Test notification sent to Telegram!");
  };

  const handleAddDevice = async (deviceData: any) => {
    try {
        await fetch('http://localhost:3001/api/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deviceData)
        });
        setIsAddModalOpen(false);
        fetchData(); // Refresh immediately
        alert("Device config saved. Backend will attempt to connect.");
    } catch (e) {
        alert("Failed to save device.");
    }
  };

  const filteredNodes = filter === 'all' ? nodes : nodes.filter(n => {
    if (filter === 'network') return ['fortigate', 'switch', 'ap'].includes(n.type);
    return n.type === filter;
  });

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-200 font-mono overflow-hidden">

      {/* SIDEBAR */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-neutral-900 border-r border-neutral-800 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="p-6 flex items-center gap-3 border-b border-neutral-800">
          <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center text-white font-bold">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white">CCC</h1>
            <div className="text-[10px] text-orange-500 tracking-widest uppercase">v3.0 GUI Edition</div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          <SidebarItem icon={<Activity size={18}/>} label="Dashboard" active={filter === 'all'} onClick={() => setFilter('all')} />

          <div className="pt-4 pb-2 text-xs text-neutral-500 font-bold uppercase tracking-wider">Network</div>
          <SidebarItem icon={<Shield size={18}/>} label="Fortinet Fabric" active={filter === 'network'} onClick={() => setFilter('network')} />

          <div className="pt-4 pb-2 text-xs text-neutral-500 font-bold uppercase tracking-wider">Infrastructure</div>
          <SidebarItem icon={<Server size={18}/>} label="Proxmox" active={filter === 'proxmox'} onClick={() => setFilter('proxmox')} />
          <SidebarItem icon={<HardDrive size={18}/>} label="Synology NAS" active={filter === 'synology'} onClick={() => setFilter('synology')} />
          <SidebarItem icon={<Terminal size={18}/>} label="Ubuntu Servers" active={filter === 'ubuntu'} onClick={() => setFilter('ubuntu')} />

          <div className="pt-4 pb-2 text-xs text-neutral-500 font-bold uppercase tracking-wider">Management</div>
          <button onClick={() => setIsAddModalOpen(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-emerald-400 hover:bg-neutral-800 hover:text-emerald-300 transition-colors">
            <PlusCircle size={18} /> Add Device
          </button>
          <button onClick={sendTestNotification} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors">
            <Bell size={18} /> Test Telegram
          </button>
        </nav>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-neutral-950">

        {/* TOP BAR */}
        <header className="h-16 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur flex items-center justify-between px-6 shrink-0">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-neutral-400"><Menu /></button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 rounded-md border border-neutral-700 text-sm w-full max-w-md mx-4">
             <Search size={14} className="text-neutral-500"/>
             <input type="text" placeholder="Search device or execute command..." className="bg-transparent border-none outline-none w-full text-neutral-300 placeholder-neutral-600"/>
          </div>
          <div className="flex items-center gap-4 text-sm font-bold text-orange-500">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
             SYSTEM NORMAL
          </div>
        </header>

        {/* DASHBOARD BODY */}
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-neutral-800">

          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">
              {filter === 'all' ? 'Mission Control' : filter}
            </h2>
            <div className="text-xs text-neutral-500">Updated: {lastUpdate.toLocaleTimeString()}</div>
          </div>

          {/* TOP CLIENTS WIDGET */}
          {['all', 'network'].includes(filter) && (
            <div className="mb-8 bg-neutral-900 border border-neutral-800 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4 text-orange-500 font-bold text-sm uppercase tracking-wider">
                <ArrowDownCircle size={16} /> Top Traffic (24H)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {topClients.map((client, idx) => (
                   <div key={idx} className="flex items-center justify-between bg-neutral-950 p-3 rounded border border-neutral-800">
                      <div>
                        <div className="font-bold text-neutral-200">{client.name}</div>
                        <div className="text-xs text-neutral-500">{client.ip} • {client.app}</div>
                      </div>
                      <div className="text-lg font-bold text-neutral-400">{client.usage}</div>
                   </div>
                 ))}
              </div>
            </div>
          )}

          {/* DEVICE GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
            {filteredNodes.map((node) => (
              <DeviceCard key={node.id} node={node} />
            ))}
          </div>

        </main>

        {/* ADD DEVICE MODAL */}
        {isAddModalOpen && (
            <AddDeviceModal onClose={() => setIsAddModalOpen(false)} onSave={handleAddDevice} />
        )}

      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function AddDeviceModal({ onClose, onSave }: { onClose: () => void, onSave: (data: any) => void }) {
    const [formData, setFormData] = useState({ name: '', ip: '', type: 'ubuntu', username: 'root' });

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Add New Device</h3>
                    <button onClick={onClose}><X className="text-neutral-500 hover:text-white" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Device Name</label>
                        <input className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white focus:border-orange-500 outline-none" 
                            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Web Server 02" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">IP Address</label>
                        <input className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white focus:border-orange-500 outline-none" 
                            value={formData.ip} onChange={e => setFormData({...formData, ip: e.target.value})} placeholder="192.168.1.X" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Device Type</label>
                        <select className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white focus:border-orange-500 outline-none"
                            value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                            <option value="ubuntu">Ubuntu / Linux</option>
                            <option value="proxmox">Proxmox Node</option>
                            <option value="synology">Synology NAS</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">SSH Username</label>
                        <input className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white focus:border-orange-500 outline-none" 
                            value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="e.g. root or pi" />
                    </div>
                    <div className="text-xs text-neutral-500 mt-2">
                        * Note: This will use the shared SSH key mounted in the Docker backend. Ensure this user exists on the target.
                    </div>
                    <button onClick={() => onSave(formData)} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded mt-4 flex items-center justify-center gap-2">
                        <Save size={18} /> Save Device
                    </button>
                </div>
            </div>
        </div>
    );
}

function DeviceCard({ node }: { node: SystemNode }) {
  const getIcon = () => {
    switch (node.type) {
      case 'fortigate': return <Shield size={18} className="text-red-500" />;
      case 'switch': return <Router size={18} className="text-blue-400" />;
      case 'ap': return <Wifi size={18} className="text-cyan-400" />;
      case 'synology': return <HardDrive size={18} className="text-yellow-500" />;
      case 'proxmox': return <Server size={18} className="text-orange-500" />;
      case 'ubuntu': return <Terminal size={18} className="text-purple-500" />;
      default: return <Box size={18} className="text-neutral-500" />;
    }
  };

  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-lg p-4 transition duration-300 hover:border-neutral-600 relative overflow-hidden group ${node.status === 'offline' ? 'opacity-75 grayscale' : ''}`}>
      {node.status === 'offline' && (
        <div className="absolute inset-0 z-10 bg-neutral-950/50 flex items-center justify-center">
            <span className="bg-red-900/80 text-white px-3 py-1 rounded text-xs font-bold border border-red-500">OFFLINE</span>
        </div>
      )}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          {getIcon()}
          <div>
            <div className="font-bold text-neutral-200 leading-none mb-1">{node.name}</div>
            <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">{node.type}</div>
          </div>
        </div>
        <div className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
      </div>
      <div className="space-y-3">
        {node.cpu !== undefined && (
          <div className="space-y-1">
             <div className="flex justify-between text-xs text-neutral-400">
               <span>Load</span>
               <span>{node.cpu}%</span>
             </div>
             <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-neutral-600" style={{width: `${node.cpu}%`}}></div>
             </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs text-neutral-400 pt-2 border-t border-neutral-800/50">
           <div className="flex items-center gap-1.5">
              <Activity size={12} className="text-neutral-600"/>
              {node.details}
           </div>
           {node.temp && node.temp !== 'N/A' && (
             <div className="flex items-center gap-1.5">
                <Thermometer size={12} className="text-neutral-600"/>
                {node.temp}
             </div>
           )}
           {node.subDetails && (
             <div className="flex items-center gap-1.5 col-span-2">
                <Zap size={12} className="text-neutral-600"/>
                {node.subDetails}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${active ? 'bg-orange-600/10 text-orange-500 border border-orange-600/20' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}>
      {icon}
      {label}
    </button>
  );
}
