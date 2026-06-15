"use client";

import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, Bell, Check, CheckCheck, ChevronDown,
  ChevronRight, CircleDot, Clock, Cloud, CloudUpload, Copy, Database, Download, Eye, EyeOff,
  File as FileIcon, FileText, Film, Flame, Folder, FolderArchive, FolderPlus, Gauge, Globe,
  HardDrive, Image as ImageIcon, Info, KeyRound, Link2, Lock, LogOut, MapPin, Maximize2, Menu,
  MoreHorizontal, Music, Pause, Play, Plus, QrCode, Radio, RefreshCw, Repeat, Rocket, Search,
  Send, Settings, Share2, Shield, Signal, Sparkles, Star, Trash2, Upload, User, Users, Volume2,
  VolumeX, Waves, Wifi, WifiOff, X, Zap, type LucideProps,
} from "lucide-react";

const MAP = {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, Bell, Check, CheckCheck, ChevronDown,
  ChevronRight, CircleDot, Clock, Cloud, CloudUpload, Copy, Database, Download, Eye, EyeOff,
  FileIcon, FileText, Film, Flame, Folder, FolderArchive, FolderPlus, Gauge, Globe, HardDrive,
  ImageIcon, Info, KeyRound, Link2, Lock, LogOut, MapPin, Maximize2, Menu, MoreHorizontal,
  Music, Pause, Play, Plus, QrCode, Radio, RefreshCw, Repeat, Rocket, Search, Send, Settings,
  Share2, Shield, Signal, Sparkles, Star, Trash2, Upload, User, Users, Volume2, VolumeX, Waves,
  Wifi, WifiOff, X, Zap,
} as const;

export type IconName = keyof typeof MAP;

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = (MAP as Record<string, React.ComponentType<LucideProps>>)[name] ?? MAP.CircleDot;
  return <Cmp {...props} />;
}
