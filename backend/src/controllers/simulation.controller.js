import {
  SIMULATION_SCENARIOS,
  isSimulationPermitted,
  runControlledAttackScenario,
} from '../simulation/simulator.service.js';
import { SimulationRun } from '../models/SimulationRun.js';

export const listScenarios = async (req, res, next) => {
  try {
    const permitted = isSimulationPermitted();
    const environment = process.env.NODE_ENV || 'development';

    const recentRuns = await SimulationRun.find({})
      .sort({ createdAt: -1 })
      .limit(25)
      .lean();

    res.status(200).json({
      success: true,
      simulationPermitted: permitted,
      environment,
      scenarios: SIMULATION_SCENARIOS,
      recentRuns,
    });
  } catch (error) {
    next(error);
  }
};

export const runScenario = async (req, res, next) => {
  try {
    const { scenario } = req.params;

    if (!isSimulationPermitted()) {
      return res.status(403).json({
        error: 'Forbidden',
        message:
          'Attack simulations are strictly prohibited in production environments. Set ALLOW_ATTACK_SIMULATION=true to enable authorized testing.',
      });
    }

    const result = await runControlledAttackScenario(scenario, req.user);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
