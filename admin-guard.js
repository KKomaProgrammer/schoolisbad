(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input && input.url ? input.url : "";
    if (!url.includes("/api/admin/blocks")) return originalFetch(input, init);

    try {
      const response = await originalFetch(input, init);
      if (response.ok) return response;
      return new Response(JSON.stringify({ blocks: [] }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ blocks: [] }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
  };
})();
