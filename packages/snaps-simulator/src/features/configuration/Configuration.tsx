import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalOverlay,
  ModalFooter,
  FormControl,
  FormLabel,
  Input,
  Switch,
  HStack,
  Textarea,
  Text,
  Divider,
  InputLeftAddon,
  InputRightAddon,
  InputGroup,
  Select,
  useColorMode,
} from '@chakra-ui/react';
import {
  fetchNpmMetadata,
  DEFAULT_NPM_REGISTRY,
} from '@metamask/snaps-controllers';
import {
  SnapIdPrefixes,
  getSnapPrefix,
  stripSnapPrefix,
} from '@metamask/snaps-utils';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import {
  getOpen,
  getSesEnabled,
  getSnapId,
  getSnapVersion,
  getSrp,
  setOpen,
  setSnapId,
  setSnapVersion,
} from './slice';
import { useDispatch, useSelector } from '../../hooks';

export const Configuration = () => {
  const dispatch = useDispatch();
  const snapUrl = useSelector(getSnapId);
  const snapVersion = useSelector(getSnapVersion);
  const srp = useSelector(getSrp);
  const sesEnabled = useSelector(getSesEnabled);
  const isOpen = useSelector(getOpen);

  const { colorMode, toggleColorMode } = useColorMode();

  const [snapIdInput, setSnapIdInput] = useState(stripSnapPrefix(snapUrl));
  const [snapIdPrefix, setSnapIdPrefix] = useState(
    getSnapPrefix(snapUrl).slice(0, -1),
  );
  const [npmVersions, setNpmVersions] = useState<string[]>([]);
  const [selectedNpmVersion, setSelectedNpmVersion] = useState<
    string | undefined
  >(snapVersion);

  const isNPM = snapIdPrefix === SnapIdPrefixes.npm.slice(0, -1);

  const handleClose = () => {
    dispatch(setSnapVersion(selectedNpmVersion));
    dispatch(setSnapId(`${snapIdPrefix}:${snapIdInput}`));
    dispatch(setOpen(false));
  };

  const handleSnapPrefixChange = (event: FormEvent<HTMLSelectElement>) => {
    setSnapIdPrefix(event.currentTarget.value as SnapIdPrefixes);
  };

  const handleSnapUrlChange = (event: FormEvent<HTMLInputElement>) => {
    setSnapIdInput(event.currentTarget.value);
  };

  const handleNpmVersionChange = (event: FormEvent<HTMLSelectElement>) => {
    setSelectedNpmVersion(event.currentTarget.value);
  };

  useEffect(() => {
    let cancelled = false;

    /**
     * Fetches the versions of the NPM snap.
     */
    async function fetchNpmVersions() {
      const metadata = await fetchNpmMetadata(
        snapIdInput,
        new URL(DEFAULT_NPM_REGISTRY),
        fetch.bind(globalThis),
      );
      const versions = Object.keys(metadata.versions).reverse();
      if (!cancelled) {
        setNpmVersions(versions);
      }
    }

    // Reset version state if the inputs are changed
    setSelectedNpmVersion(undefined);
    setNpmVersions([]);

    // If input is an NPM snap, try to repopulate the version state
    if (isNPM) {
      fetchNpmVersions().catch((error) => {
        // eslint-disable-next-line no-console
        console.error(error);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [snapIdInput, snapIdPrefix, isNPM]);

  // const handleSrpChange = (event: FormEvent<HTMLTextAreaElement>) => {
  //   dispatch(setSrp(event.currentTarget.value));
  // };
  //
  // const handleSesToggle = () => {
  //   dispatch(setSesEnabled(!sesEnabled));
  // };

  const handleDarkModeToggle = () => {
    toggleColorMode();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader pb="0">
          <Text fontSize="md">Configure environment</Text>
          <Text fontSize="sm" color="#535A61" fontWeight="400">
            Settings and variables to setup the simulation context.
          </Text>
        </ModalHeader>
        <Divider my="4" />
        <ModalBody pt="0">
          <FormControl>
            <FormLabel>Snap location</FormLabel>
            <InputGroup>
              <InputLeftAddon
                px="0"
                bg="chakra-body-bg"
                borderColor="border.default"
              >
                <Select
                  border="none"
                  onChange={handleSnapPrefixChange}
                  value={snapIdPrefix}
                >
                  <option value="local">local</option>
                  <option value="npm">npm</option>
                </Select>
              </InputLeftAddon>
              <Input
                type="text"
                value={snapIdInput}
                onChange={handleSnapUrlChange}
                data-testid="snap-id-input"
              />
              {isNPM && npmVersions.length > 0 && (
                <InputRightAddon
                  px="0"
                  bg="chakra-body-bg"
                  borderColor="border.default"
                >
                  <Select
                    border="none"
                    onChange={handleNpmVersionChange}
                    value={selectedNpmVersion}
                  >
                    {npmVersions.map((version) => (
                      <option key={`version-${version}`} value={version}>
                        {version}
                      </option>
                    ))}
                  </Select>
                </InputRightAddon>
              )}
            </InputGroup>

            <FormLabel>Environment SRP</FormLabel>
            <Textarea
              value={srp}
              readOnly={true}
              color="text.muted"
              fontSize="sm"
              // onChange={handleSrpChange}
            />

            <HStack alignItems="center" justifyContent="space-between" mb="4">
              <FormLabel mb="0" htmlFor="ses-switch">
                Secure EcmaScript (SES)
              </FormLabel>
              <Switch
                id="ses-switch"
                size="lg"
                isChecked={sesEnabled}
                // onChange={handleSesToggle}
                readOnly={true}
                colorScheme="gray"
              />
            </HStack>

            <HStack alignItems="center" justifyContent="space-between">
              <FormLabel mb="0" htmlFor="darkmode-switch">
                Dark Mode
              </FormLabel>
              <Switch
                id="darkmode-switch"
                size="lg"
                isChecked={colorMode === 'dark'}
                onChange={handleDarkModeToggle}
                colorScheme="gray"
              />
            </HStack>
          </FormControl>
        </ModalBody>
        <Divider my="4" />
        <ModalFooter pb="6" pt="2">
          <Button
            variant="primary"
            fontFamily="default"
            fontWeight="semibold"
            fontSize="sm"
            width="100%"
            onClick={handleClose}
          >
            Apply config
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
