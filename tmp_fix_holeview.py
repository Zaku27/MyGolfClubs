from pathlib import Path

path = Path('src/components/simulator/HoleView.tsx')
text = path.read_text(encoding='utf-8')
old = '''          {/* ショット方針の注意案内 */}
          <div className={[
            "rounded-xl px-4 py-3 text-left",
            "border border-emerald-300/70 bg-emerald-100/70 text-emerald-900"
          ].join(" ")}>
            <p className={[
              "text-[11px] font-bold tracking-[0.16em]",
              "text-emerald-700"
            ].join(" ")}>ショット方針の注意</p>
            <p className="mt-1 text-xs sm:text-sm">
              {!selectedClub && "クラブを選ぶと、この位置にショット前の注意が表示されます。"}
              {selectedClub && (
                selectedEffectiveRate !== null
                  ? `ショットはクラブ成功率:${selectedEffectiveRate}%で実行されます。`
                  : "ショットはクラブ成功率:--%で実行されます。"
              )}
            </p>
          {/* ショットボタン */}
'''
replacement = '          {/* ショットボタン */}\n'
if old not in text:
    raise RuntimeError('Exact block not found in file')
text = text.replace(old, replacement)
path.write_text(text, encoding='utf-8')
print('replaced')
