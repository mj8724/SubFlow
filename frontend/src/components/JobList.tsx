"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function JobList() {
  const [jobs, setJobs] = useState<any[]>([]);

  const fetchJobs = async () => {
    try {
      const res = await axios.get('http://localhost:8888/api/jobs');
      setJobs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'processing': return <Loader2 className="animate-spin text-blue-400" size={18} />;
      case 'completed': return <CheckCircle2 className="text-green-400" size={18} />;
      case 'failed': return <XCircle className="text-red-400" size={18} />;
      default: return <Clock className="text-neutral-400" size={18} />;
    }
  };

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 shadow-lg h-full flex flex-col">
      <h2 className="text-lg font-semibold text-white mb-6 flex items-center space-x-2">
        <div className="w-2 h-6 bg-purple-500 rounded-full"></div>
        <span>Translation Tasks</span>
      </h2>
      
      <div className="flex-1 overflow-y-auto pr-2">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 space-y-3">
            <Clock size={32} className="opacity-50" />
            <p>No tasks yet. Select a video to begin.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="bg-neutral-950/50 rounded-lg p-4 border border-neutral-800/50 hover:border-neutral-700 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-medium text-neutral-200 truncate" title={job.file_path}>
                      {job.file_path.split('/').pop()}
                    </p>
                    <p className="text-xs text-neutral-500 font-mono mt-1">ID: {job.id}</p>
                  </div>
                  <div className="flex items-center space-x-2 bg-neutral-900 px-2.5 py-1 rounded-full border border-neutral-800">
                    {getStatusIcon(job.status)}
                    <span className="text-xs font-medium capitalize text-neutral-300">{job.status}</span>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-neutral-800 rounded-full h-1.5 mt-2 overflow-hidden shadow-inner">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      job.status === 'completed' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 
                      job.status === 'failed' ? 'bg-red-500' : 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                    }`}
                    style={{ width: `${job.status === 'completed' ? 100 : job.progress * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
