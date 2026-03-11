Set WshShell = CreateObject("WScript.Shell")
StartupFolder = WshShell.SpecialFolders("Startup")
Set shortcut = WshShell.CreateShortcut(StartupFolder & "\PROTECTHER-Startup.lnk")
shortcut.TargetPath = "C:\PROJECTS\PRO-NHRCL\start-protecther.bat"
shortcut.WorkingDirectory = "C:\PROJECTS\PRO-NHRCL"
shortcut.Description = "Start PROTECTHER Audit Panel Services"
shortcut.Save
WScript.Echo "Shortcut created in Startup folder!"
