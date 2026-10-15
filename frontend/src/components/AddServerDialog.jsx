import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Server, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { apiCreateServer } from '@/utils/api';

const DEFAULT_FORM = {
  serverName: '',
  hostname: '',
  os: 'Linux',
  environment: 'Production',
  description: '',
};

export default function AddServerDialog({ open, onOpenChange, onServerCreated }) {
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [apiSuccess, setApiSuccess] = useState(null);

  const validate = () => {
    const errs = {};
    if (!formData.serverName.trim()) {
      errs.serverName = 'Server name is required.';
    } else if (formData.serverName.trim().length < 2) {
      errs.serverName = 'Server name must be at least 2 characters.';
    }

    if (!formData.hostname.trim()) {
      errs.hostname = 'Hostname is required.';
    } else if (formData.hostname.trim().length < 2) {
      errs.hostname = 'Hostname must be at least 2 characters.';
    } else if (
      !/^[a-zA-Z0-9]([a-zA-Z0-9-_.]{0,251}[a-zA-Z0-9])?$/.test(
        formData.hostname.trim()
      )
    ) {
      errs.hostname =
        'Valid hostname required (e.g. payment-01.company.local or srv-prod-01).';
    }

    if (!['Linux', 'Windows'].includes(formData.os)) {
      errs.os = 'OS must be Linux or Windows.';
    }

    if (!['Development', 'Staging', 'Production'].includes(formData.environment)) {
      errs.environment = 'Environment must be Development, Staging, or Production.';
    }

    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    setApiError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setApiError(null);
    setApiSuccess(null);

    try {
      const payload = {
        serverName: formData.serverName.trim(),
        hostname: formData.hostname.trim().toLowerCase(),
        os: formData.os,
        environment: formData.environment,
        description: formData.description.trim(),
      };

      const res = await apiCreateServer(payload);
      setApiSuccess(res.message || 'Server registered successfully.');

      setTimeout(() => {
        if (onServerCreated) {
          onServerCreated(res.server);
        }
        setFormData(DEFAULT_FORM);
        setApiSuccess(null);
        onOpenChange(false);
      }, 1200);
    } catch (err) {
      setApiError(err.message || 'Failed to register server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreFillExample = () => {
    const rand = Math.floor(100 + Math.random() * 900);
    setFormData({
      serverName: `PAYMENT-GATEWAY-${rand}`,
      hostname: `pay-node-${rand}.internal.network`,
      os: 'Linux',
      environment: 'Production',
      description: 'Primary transaction settlement microservice host',
    });
    setErrors({});
    setApiError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white tracking-tight">
                  Register New Fleet Server
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400 mt-0.5">
                  Provision a host node identifier to enable secure collector enrollment.
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreFillExample}
              disabled={submitting}
              className="text-xs h-7 border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 cursor-pointer font-medium"
            >
              Demo Fill
            </Button>
          </div>
        </DialogHeader>

        {apiError && (
          <Alert variant="destructive" className="py-2.5">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-xs font-bold">Registration Error</AlertTitle>
            <AlertDescription className="text-xs">{apiError}</AlertDescription>
          </Alert>
        )}

        {apiSuccess && (
          <Alert variant="success" className="py-2.5">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle className="text-xs font-bold">Server Registered</AlertTitle>
            <AlertDescription className="text-xs">{apiSuccess}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="serverName" className="text-xs font-semibold text-zinc-300">
              Server Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="serverName"
              name="serverName"
              value={formData.serverName}
              onChange={handleChange}
              placeholder="e.g. PAYMENT-SERVER-01"
              disabled={submitting}
              className={`bg-zinc-950 border-zinc-700 text-xs h-9 text-white placeholder:text-zinc-600 ${
                errors.serverName ? 'border-red-500 focus-visible:ring-red-500' : ''
              }`}
            />
            {errors.serverName && (
              <p className="text-xs text-red-400 font-medium">{errors.serverName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hostname" className="text-xs font-semibold text-zinc-300">
              Hostname / FQDN <span className="text-red-400">*</span>
            </Label>
            <Input
              id="hostname"
              name="hostname"
              value={formData.hostname}
              onChange={handleChange}
              placeholder="e.g. payment-01.company.local"
              disabled={submitting}
              className={`bg-zinc-950 border-zinc-700 text-xs h-9 font-mono text-white placeholder:text-zinc-600 ${
                errors.hostname ? 'border-red-500 focus-visible:ring-red-500' : ''
              }`}
            />
            {errors.hostname && (
              <p className="text-xs text-red-400 font-medium">{errors.hostname}</p>
            )}
            <p className="text-xs text-zinc-500">
              HashVault does not make outbound network calls to hostnames.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="os" className="text-xs font-semibold text-zinc-300">
                Operating System
              </Label>
              <select
                id="os"
                name="os"
                value={formData.os}
                onChange={handleChange}
                disabled={submitting}
                className="w-full h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white"
              >
                <option value="Linux">Linux</option>
                <option value="Windows">Windows</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="environment" className="text-xs font-semibold text-zinc-300">
                Environment
              </Label>
              <select
                id="environment"
                name="environment"
                value={formData.environment}
                onChange={handleChange}
                disabled={submitting}
                className="w-full h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white"
              >
                <option value="Production">Production</option>
                <option value="Staging">Staging</option>
                <option value="Development">Development</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold text-zinc-300">
              Description <span className="text-zinc-500 font-normal">(Optional)</span>
            </Label>
            <Input
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Operational description or service scope"
              disabled={submitting}
              className="bg-zinc-950 border-zinc-700 text-xs h-9 text-white placeholder:text-zinc-600"
            />
          </div>

          <DialogFooter className="pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="text-xs border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white cursor-pointer font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="text-xs bg-white hover:bg-zinc-200 text-zinc-950 font-bold cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Registering...
                </>
              ) : (
                'Register Node'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
