'use client';
import Link from 'next/link';
import { Anchor, Button, type AnchorProps, type ButtonProps } from '@mantine/core';

/*
 * Liens Next.js habillés par Mantine. Composants client : une page serveur ne peut pas transmettre
 * `component={Link}` (une fonction) à un composant client.
 */
type LinkProps = { href: string; children: React.ReactNode; target?: string; rel?: string; 'aria-label'?: string };

export function ButtonLink({ href, children, ...props }: LinkProps & ButtonProps) {
  return <Button component={Link} href={href} {...props}>{children}</Button>;
}

export function TextLink({ href, children, ...props }: LinkProps & AnchorProps) {
  return <Anchor component={Link} href={href} underline="always" {...props}>{children}</Anchor>;
}

/** Logo texte « tournio. » avec le point d’accent. */
export function Brand({ size = 32, href = '/' }: { size?: number; href?: string }) {
  return <Anchor component={Link} href={href} className="brand" underline="never" c="var(--mantine-color-bright)" fz={size}>tournio<span>.</span></Anchor>;
}
