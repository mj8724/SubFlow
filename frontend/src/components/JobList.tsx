"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, CheckCircle2, XCircle, Clock, Trash2, Download, Terminal, Music } from 'lucide-react';
import LogModal from './LogModal';

export default function JobList() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

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

  const clearJobs = async () => {
    try {
      await axios.delete('http://localhost:8888/api/jobs');
      setJobs([]);
    } catch (err) {
      console.error("Failed to clear jobs:", err);
    }
  };

  const getStatusIcon = (status: string, jobType: string = 'subtitle') => {
    if (status.startsWith('downloading_model')) return <Download className="animate-bounce text-purple-400" size={18} />;
    switch(status) {
      case 'processing': return <Loader2 className="animate-spin text-blue-400" size={18} />;
      case 'completed': return jobType === 'extract_audio' ? <Music className="text-blue-400" size={18} /> : <CheckCircle2 className="text-green-400" size={18} />;
      case 'failed': return <XCircle className="text-red-400" size={18} />;
      default: return <Clock className="text-neutral-400" size={18} />;
    }
  };

  const getStatusText = (status: string, progress: number, jobType: string = 'subtitle') => {
    if (status.startsWith('downloading_model')) {
      const parts = status.split('|');
      if (parts.length === 3) {
        return `Downloading Model... ${parts[1]} (${parts[2]})`;
      }
      return 'Downloading Model...';
    }
    if (jobType === 'extract_audio') {
      if (status === 'processing') return `正在提取音频... ${Math.round(progress * 100)}%`;
      if (status === 'completed') return '音频已提取';
      if (status === 'failed') return '提取失败';
      return status;
    }
    if (status === 'processing') {
      let step = 'Processing...';
      if (progress < 0.3) step = 'Extracting Audio...';
      else if (progress < 0.6) step = 'Transcribing Audio...';
      else if (progress < 0.9) step = 'Translating Text...';
      else if (progress < 1.0) step = 'Generating Subtitles...';
      return `${step} ${Math.round(progress * 100)}%`;
    }
    return status;
  };

  return (
    <>
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 shadow-lg h-full flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
            <div className="w-2 h-6 bg-purple-500 rounded-full"></div>
            <span>任务列表</span>
          </h2>
          {jobs.length > 0 && (
            <button 
              onClick={clearJobs}
              className="text-neutral-400 hover:text-red-400 transition-colors flex items-center space-x-1 text-sm p-1.5 hover:bg-red-500/10 rounded-md"
              title="Clear all tasks"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
        
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
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-neutral-200 truncate" title={job.file_path}>
                          {job.file_path.split('/').pop()}
                        </p>
                        {job.job_type === 'extract_audio' && (
                          <span className="flex items-center space-x-1 bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-xs flex-shrink-0">
                            <Music size={10} />
                            <span>音频</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 font-mono mt-1">ID: {job.id}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-2 bg-neutral-900 px-2.5 py-1 rounded-full border border-neutral-800">
                        {getStatusIcon(job.status, job.job_type)}
                        <span className="text-xs font-medium capitalize text-neutral-300">{getStatusText(job.status, job.progress, job.job_type)}</span>
                      </div>
                      <button 
                        onClick={() => setSelectedJobId(job.id)}
                        className="p-1.5 text-neutral-400 hover:text-purple-400 bg-neutral-900 hover:bg-neutral-800 rounded-md border border-neutral-800 transition-colors"
                        title="View Logs"
                      >
                        <Terminal size={14} />
                      </button>
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

      <LogModal 
        isOpen={selectedJobId !== null} 
        onClose={() => setSelectedJobId(null)} 
        jobId={selectedJobId} 
      />
    </>
  );
}
