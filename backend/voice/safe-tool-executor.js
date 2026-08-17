class SafeToolExecutor {
  constructor() {
    this.fastToolThreshold = 500;
    this.slowToolTimeout = 2000;
    this.globalTimeout = 8000;
  }

  async executeTools(toolPlan) {
    if (!toolPlan || toolPlan.length === 0) {
      return [];
    }

    const fastTools = toolPlan.filter(tool => (tool.estimatedDuration || 500) < this.fastToolThreshold);
    const slowTools = toolPlan.filter(tool => (tool.estimatedDuration || 500) >= this.fastToolThreshold);

    const fastResults = await Promise.allSettled(
      fastTools.map(tool => this.executeSafely(tool))
    );

    const slowResults = await Promise.allSettled(
      slowTools.map(tool => this.executeWithFallback(tool, this.slowToolTimeout))
    );

    return [...fastResults, ...slowResults]
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
  }

  async executeSafely(tool) {
    try {
      if (!tool || typeof tool.execute !== 'function') {
        return {
          tool: tool?.name || 'unknown',
          success: false,
          error: true,
          message: 'Tool missing execute function'
        };
      }

      const result = await tool.execute();
      return {
        tool: tool.name,
        success: true,
        data: result,
        source: tool.name
      };
    } catch (error) {
      return {
        tool: tool?.name || 'unknown',
        success: false,
        error: true,
        message: error.message || 'Tool execution failed'
      };
    }
  }

  async executeWithFallback(tool, timeout) {
    return Promise.race([
      this.executeSafely(tool),
      new Promise(resolve =>
        setTimeout(
          () =>
            resolve({
              tool: tool?.name || 'unknown',
              success: false,
              fallback: true,
              message: 'Consultando informações...',
              source: 'fallback'
            }),
          timeout
        )
      )
    ]);
  }

  async executeWithGlobalTimeout(toolPlan) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('GLOBAL_TOOL_TIMEOUT')), this.globalTimeout)
    );

    try {
      const results = await Promise.race([this.executeTools(toolPlan), timeoutPromise]);
      return results;
    } catch (error) {
      if (error.message === 'GLOBAL_TOOL_TIMEOUT') {
        return [
          {
            tool: 'global',
            success: false,
            fallback: true,
            message: 'Estou consultando isso para você...',
            source: 'timeout-fallback'
          }
        ];
      }
      throw error;
    }
  }
}

let instance = null;

function getSafeToolExecutor() {
  if (!instance) {
    instance = new SafeToolExecutor();
  }
  return instance;
}

module.exports = {
  getSafeToolExecutor,
  SafeToolExecutor
};
