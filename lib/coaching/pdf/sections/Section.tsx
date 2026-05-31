import React from "react";
import { Text, View } from "@react-pdf/renderer";

import { pdfStyles } from "../pdfTheme";
import type { JsonObject, JsonValue } from "../../schemas/intakeSchema";

export type SectionProps = {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
};

export function Section({ title, eyebrow, children }: SectionProps) {
  return (
    <View style={pdfStyles.section} wrap={false}>
      {eyebrow ? <Text style={pdfStyles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={pdfStyles.heading}>{title}</Text>
      {children}
    </View>
  );
}

export function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <Text style={pdfStyles.muted}>No details provided.</Text>;
  }

  return (
    <View style={pdfStyles.list}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={pdfStyles.listItem}>
          <Text style={pdfStyles.bullet}>•</Text>
          <Text style={pdfStyles.listItemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function KeyValueList({ entries }: { entries: Array<[string, string]> }) {
  return (
    <View style={pdfStyles.panel}>
      {entries.map(([label, value]) => (
        <View key={label} style={{ marginBottom: 5 }}>
          <Text style={pdfStyles.smallCaps}>{label}</Text>
          <Text>{value || "Not provided"}</Text>
        </View>
      ))}
    </View>
  );
}

export function stringifyJson(value: JsonValue | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

export function getStringList(source: JsonObject, keys: string[]): string[] {
  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value.map((item) => stringifyJson(item)).filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
      return [value];
    }
  }

  return [];
}

export function getText(source: JsonObject, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];

    if (value !== undefined && value !== null) {
      return stringifyJson(value);
    }
  }

  return "";
}
