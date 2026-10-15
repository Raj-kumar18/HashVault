import {
  getMonitoringOverview,
  getMonitoredServers,
} from '../services/monitoring.service.js';
import { runMonitoringCycle, getSchedulerStatus } from '../monitoring/scheduler.js';

export const getOverview = async (req, res, next) => {
  try {
    const overview = await getMonitoringOverview();
    const scheduler = getSchedulerStatus();

    res.status(200).json({
      success: true,
      monitoring: overview,
      scheduler,
    });
  } catch (error) {
    next(error);
  }
};

export const getServers = async (req, res, next) => {
  try {
    const servers = await getMonitoredServers();
    res.status(200).json({
      success: true,
      servers,
      count: servers.length,
    });
  } catch (error) {
    next(error);
  }
};

export const triggerCycle = async (req, res, next) => {
  try {
    const result = await runMonitoringCycle();
    res.status(200).json({
      success: true,
      result: result || { message: 'Monitoring cycle executed.' },
    });
  } catch (error) {
    next(error);
  }
};
