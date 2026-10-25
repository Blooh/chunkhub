package net.chunkhub.companion;

import java.lang.reflect.Method;

/** Calls game methods by name, so the mod keeps working when small details change between versions. Safe on servers. */
final class Reflect {
	private Reflect() {}

	static Object call(Object target, String name, Object... args) {
		if (target == null) return null;
		for (Class<?> c = target.getClass(); c != null; c = c.getSuperclass()) {
			for (Method m : c.getDeclaredMethods()) {
				if (!m.getName().equals(name) || m.getParameterCount() != args.length) continue;
				Class<?>[] p = m.getParameterTypes(); boolean fits = true;
				for (int i = 0; i < p.length && fits; i++) fits = args[i] == null || wrap(p[i]).isInstance(args[i]);
				if (!fits) continue;
				try { m.setAccessible(true); return m.invoke(target, args); } catch (Exception e) { ChunkHub.LOG.debug("{} failed", name, e); return null; }
			}
		}
		for (Method m : target.getClass().getMethods()) {
			if (!m.getName().equals(name) || m.getParameterCount() != args.length) continue;
			try { return m.invoke(target, args); } catch (Exception e) { return null; }
		}
		return null;
	}

	private static Class<?> wrap(Class<?> c) {
		if (!c.isPrimitive()) return c;
		if (c == boolean.class) return Boolean.class;
		if (c == int.class) return Integer.class;
		if (c == long.class) return Long.class;
		if (c == float.class) return Float.class;
		if (c == double.class) return Double.class;
		return c;
	}
}
