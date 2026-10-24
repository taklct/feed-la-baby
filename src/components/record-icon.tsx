import { FontAwesome6 } from "@expo/vector-icons";
import Svg, { Path, Rect } from "react-native-svg";
import type { RecordType } from "../constants/records";

export function RecordIcon({
  type,
  color,
  size,
}: {
  type: RecordType;
  color: string;
  size: number;
}) {
  if (type === "milk") {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M10.5 2.5h3v2.2h-3z" />
        <Rect x={7} y={4.7} width={10} height={2.6} rx={1.3} />
        <Path d="M8 7.3h8v11.6a2.6 2.6 0 0 1-2.6 2.6h-2.8A2.6 2.6 0 0 1 8 18.9z" />
      </Svg>
    );
  }
  if (type === "poop") {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M3.5 6h17v3.6c0 4.9-3.8 8.9-8.5 8.9s-8.5-4-8.5-8.9z" />
        <Path d="M3.5 9.5h17M7.5 9.5v2.4M16.5 9.5v2.4" />
      </Svg>
    );
  }
  return (
    <FontAwesome6
      name={type === "pee" ? "droplet" : "bath"}
      size={size - 3}
      color={color}
    />
  );
}
