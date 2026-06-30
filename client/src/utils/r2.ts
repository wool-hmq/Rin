// 从R2获取JSON数据的通用函数
export async function fetchR2Json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('R2 fetch failed:', err);
    return null;
  }
}

// 从R2获取文本内容（用于HTML/Markdown）
export async function fetchR2Text(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    console.error('R2 fetch failed:', err);
    return null;
  }
}
